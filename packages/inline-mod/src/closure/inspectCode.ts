import { Entry, EntryRegistry } from './entry.js';
import { Lazy } from './lazy.js';
import { InspectedFunction, InspectedObject, PropertyMap } from './types.js';
import * as utils from './utils.js';
import { parseFunction, type CapturedVariables } from './parseFunction.js';
import * as v8 from './v8.js';

interface ContextFrame {
	// TODO: Add reporting for function location
	// functionLocation?: FunctionLocation;
	capturedFunctionName?: string;
	capturedVariableName?: string;
	isArrowFunction?: boolean;
	captureModule?: { name: string; value: any };
}

/**
 * @internal
 */
export function inspectValue(value: NonNullable<object>): InspectedObject {
	Inspector.inspect(value);

	return {
		env: new Map(),
	};
}

// Prevent capture from recursing into the inspection logic.
// This function and all the tooling it refer to cannot be serialized.
(inspectValue as any).doNotCapture = true;

/**
 * @internal
 */
class Inspector {
	// The cache stores a map of objects to the entries we've created for them.  It's used so that
	// we only ever create a single environemnt entry for a single object. i.e. if we hit the same
	// object multiple times while walking the memory graph, we only emit it once.
	public readonly cache = new EntryRegistry<Object>();

	// The 'frames' we push/pop as we're walking the object graph serializing things.
	// These frames allow us to present a useful error message to the user in the context
	// of their code as opposed the async callstack we have while serializing.
	private readonly frames: ContextFrame[] = [];

	// A mapping from a class method/constructor to the environment entry corresponding to the
	// __super value.  When we emit the code for any class member we will end up adding
	//
	//  with ( { __super: <...> })
	//
	// We will also rewrite usages of "super" in the methods to refer to __super.  This way we can
	// accurately serialize out the class members, while preserving functionality.
	private readonly classInstanceMemberToSuperEntry = new EntryRegistry<Function>();
	private readonly classStaticMemberToSuperEntry = new EntryRegistry<Function>();

	// A list of 'simple' functions.  Simple functions do not capture anything, do not have any
	// special properties on them, and do not have a custom prototype.  If we run into multiple
	// functions that are simple, and share the same code, then we can just emit the function once
	// for them.
	// A good example of this is polyfill functions injected by transpilation steps. Normally,
	// those functions are repeated for every emitted file that uses them. Instead of generating
	// a serialized function for each of those, we can emit them a single time.
	private readonly simpleFunctions: Entry<'function'>[] = [];

	private constructor(private readonly serialize: (o: unknown) => boolean) {}

	public static inspect(value: object): unknown {
		const inspector = new this(() => true);

		return inspector.inspect(value);
	}

	private async inspect(value: unknown): Promise<Entry> {
		// Try simple values
		if (value == null) {
			return Entry.json(value);
		}

		switch (typeof value) {
			case 'number':
				return this.inspectNumber(value);
			case 'boolean':
			case 'string':
				return Entry.json(value);
		}

		// Check for a cache hit
		{
			const entry = this.cache.lookup(value);
			if (entry) {
				if (entry.type === 'object') {
					// Even though we've already serialized out this object, it might be the case
					// that we serialized out a different set of properties than the current set
					// we're being asked to serialize.  So we have to make sure that all these props
					// are actually serialized.
					await this.inspectObject(value);
				}
				return entry;
			}
		}

		this.cache.prepare(value);

		const entry: Entry;

		this.cache.add(value, entry);

		return entry;
	}

	private inspectNumber(val: number): Entry {
		// Check if this is a special number that we cannot json serialize.  Instead, we'll just inject
		// the code necessary to represent the number on the other side.  Note: we have to do this
		// before we do *anything* else.  This is because these special numbers don't even work in maps
		// properly.  So, if we lookup the value in a map, we may get the cached value for something
		// else *entirely*.  For example, 0 and -0 will map to the same entry.
		if (Object.is(val, -0)) {
			return Entry.expr('-0');
		}
		if (Object.is(val, NaN)) {
			return Entry.expr('NaN');
		}
		if (Object.is(val, Infinity)) {
			return Entry.expr('Infinity');
		}
		if (Object.is(val, -Infinity)) {
			return Entry.expr('-Infinity');
		}

		// Not special, just use normal json serialization.
		return Entry.json(val);
	}

	private async inspectFunction(func: Function): Promise<Entry<'function'>> {
		if (hasTrueBooleanMember(func, 'doNotCapture')) {
			// If we get a function we're not supposed to capture, emit a function that will throw
			// at runtime so the user can understand the problem better.
			const funcName = func.name || 'anonymous';
			const message = `Function ${funcName} cannot be safely serialized.`;

			func = () => {
				throw new Error(message);
			};
		}

		// TODO: Add location information back in
		// const location = v8.getFunctionLocationAsync
		const frame: ContextFrame = { isArrowFunction: false };

		this.frames.push(frame);
		const entry: Entry<'function'> = {
			type: 'function',
			value: await this.serializeWorker(func),
		};
		this.frames.pop();

		if (InspectedFunction.isSimple(entry.value)) {
			const existingSimpleFunction = this.findSimpleFunction(entry.value);

			if (existingSimpleFunction) {
				return existingSimpleFunction;
			} else {
				this.simpleFunctions.push(entry.value);
				entry.value = existingSimpleFunction;
			}
		}

		this.cache.add(func, entry);

		return entry;
	}

	private async serializeWorker(func: Function): Promise<InspectedFunction> {
		const funcEntry = this.cache.preparedLookup(func);
		const frame = this.frames.at(-1)!;
		const functionString = func.toString();

		const [error, parsedFunction] = parseFunction(functionString);
		if (error) {
			this.throwSerializableError(func, error);
		}

		frame.isArrowFunction = parsedFunction.isArrowFunction;
		const { funcExprWithName, functionDeclarationName } = parsedFunction;

		const capturedValues: PropertyMap = await this.processCapturedVariables(
			parsedFunction.capturedVariables
		);

		const functionInfo: InspectedFunction = {
			code: parsedFunction.funcExprWithoutName,
			capturedValues: capturedValues,
			env: new Map(),
			usesNonLexicalThis: parsedFunction.usesNonLexicalThis,
			name: functionDeclarationName,
			paramCount: func.length,
		};

		const proto = Object.getPrototypeOf(func);
		// https://github.com/pulumi/pulumi/blob/d4969f3338eb55f8072518ca89ed17a9b72bde93/sdk/nodejs/runtime/closure/createClosure.ts#L625-L628
		const isAsyncFunction = func.constructor && func.constructor.name === 'AsyncFunction';

		// Ensure the Function's prototype is also serialized.
		// This is only needed for functions with custom prototype, be it classes
		// or functions with explicitly set prototype.
		if (
			!Object.is(proto, Function.prototype) &&
			!isAsyncFunction &&
			isDerivedNoCaptureConstructor(func)
		) {
			const protoEntry = await this.inspect(proto);
			functionInfo.proto = protoEntry;

			if (functionString.startsWith('class ')) {
				// This was a class (which is effectively synonymous with a constructor-function).
				// We also know that it's a derived class because of the `proto !==
				// Function.prototype` check above.  (The prototype of a non-derived class points at
				// Function.prototype).
				//
				// they're a bit trickier to serialize than just a straight function. Specifically,
				// we have to keep track of the inheritance relationship between classes.  That way
				// if any of the class members references 'super' we'll be able to rewrite it
				// accordingly (since we emit classes as Functions)
				await processDerivedClassConstructorAsync(protoEntry);

				// Because this was was class constructor function, rewrite any 'super' references
				// in it do its derived type if it has one.
				functionInfo.code = rewriteSuperReferences(funcExprWithName!, /*isStatic*/ false);
			}
		}

		// Capture any property on the function itself.
		for (const descriptor of await this.getOwnPropertyDescriptors(func)) {
			if (descriptor.name === 'length' || descriptor.name === 'name') {
				// Do not capture `length` and `name` properties since those cannot
				// be changed anyway.
				continue;
			}

			const funcProp = await this.getOwnProperty(func, descriptor);

			if (
				descriptor.name === 'prototype' &&
				(await this.isDefaultFunctionPrototype(func, funcProp))
			) {
				// Only emit the function's prototype if it actually changed.
				continue;
			}

			const keyEntry = await this.inspect(getNameOrSymbol(descriptor));
			const valEntry = await this.inspect(funcProp);
			const propertyInfo = await this.createPropertyInfo(descriptor);

			functionInfo.env.set(keyEntry, {
				info: propertyInfo,
				entry: valEntry,
			});
		}

		const superEntry =
			this.classInstanceMemberToSuperEntry.lookup(func) ??
			this.classStaticMemberToSuperEntry.lookup(func);
		if (superEntry) {
			// This was a class constructor or method. We need to put a special `__super`
			// entry into scope and then rewrite any calls to `super()` to refer to it.
			capturedValues.set(await this.inspect('__super'), {
				entry: superEntry,
			});

			functionInfo.code = rewriteSuperReference(
				funcExprWithName,
				this.classStaticMemberToSuperEntry.lookup(func) !== undefined
			);
		}

		// If this was a named function (literally, only a named function-expr or function-decl), then
		// place an entry in the environment that maps from this function name to the serialized
		// function we're creating.  This ensures that recursive functions will call the right method.
		// i.e if we have "function f() { f(); }" this will get rewritten to:
		//
		//      function __f() {
		//          with ({ f: __f }) {
		//              return function () { f(); }
		//
		// i.e. the inner call to "f();" will actually call the *outer* __f function, and not
		// itself.
		if (functionDeclarationName !== undefined) {
			capturedValues.set(await this.inspect(functionDeclarationName), {
				entry: funcEntry,
			});
		}

		return functionInfo;
	}

	private async processCapturedVariables(
		func: Function,
		capturedVariables: CapturedVariables
	): Promise<PropertyMap> {
		const capturedValues: PropertyMap = new Map();

		for (const scope of ['required', 'optional'] as const) {
			for (const [name, properties] of capturedVariables[scope].entries()) {
				const value = await v8
					.lookupCapturedVariableValue(func, name, scope === 'required')
					.catch((err) => {
						this.throwSerializableError(func, err.message);
					});

				const moduleName = await this.findNormalizedModuleName(value);
				const frameLength = this.frames.length;

				if (moduleName) {
					this.frames.push({
						captureModule: {
							name: moduleName,
							value: value,
						},
					});
				} else if (value instanceof Function) {
					// Only bother pushing on context frame if the name of the variable
					// we captured is different from the name of the function.  If the
					// names are the same, this is a direct reference, and we don't have
					// to list both the name of the capture and of the function.  if they
					// are different, it's an indirect reference, and the name should be
					// included for clarity.
					if (name !== value.name) {
						this.frames.push({ capturedFunctionName: name });
					}
				} else {
					this.frames.push({ capturedVariableName: name });
				}

				const serializedName = await this.inspect(name);
				const serializedValue = await this.inspect(value);

				capturedValues.set(serializedName, { entry: serializedValue });

				while (this.frames.length > frameLength) {
					// Pop the frames until we are back where we begun.
					this.frames.pop();
				}
			}
		}

		return capturedValues;
	}

	private findSimpleFunction(info: InspectedFunction): Entry<'function'> | undefined {
		for (const simpleEntry of this.simpleFunctions) {
			const simpleFunction = simpleEntry.value;
			if (
				simpleFunction.code === info.code &&
				simpleFunction.usesNonLexicalThis === info.usesNonLexicalThis
			) {
				return simpleEntry;
			}
		}
	}

	private doNotCapture(value: object): boolean {
		if (!this.serialize(value)) {
			return true;
		}

		if (hasTrueBooleanMember(value, 'doNotCapture')) {
			return true;
		}

		return false;
	}

	private throwSerializableError(value: unknown, info: string): never {
		// TODO: Implement nice error
		throw new Error('not implemented');
	}
}

/**
 * Cache of global entries
 */
class GlobalCache {
	private static singleton = Lazy.of(() => new this());

	public static fork(): EntryRegistry<Object> {
		return this.singleton.get().cache.fork();
	}

	// The cache stores a map of objects to the entries we've created for them.  It's used so that
	// we only ever create a single environemnt entry for a single object. i.e. if we hit the same
	// object multiple times while walking the memory graph, we only emit it once.
	private readonly cache = new EntryRegistry<Object>();

	private constructor() {
		this.addWellKnownGlobalEntries();
	}

	private addWellKnownGlobalEntries() {
		this.addGlobalInfo('Object');
		this.addGlobalInfo('Function');
		this.addGlobalInfo('Array');
		this.addGlobalInfo('Number');
		this.addGlobalInfo('String');

		// Global prototype chain
		for (let current = global; current; current = Object.getPrototypeOf(current)) {
			for (const key of Object.getOwnPropertyNames(current)) {
				// "GLOBAL" and "root" are deprecated and give warnings if you try to access them.
				if (key !== 'GLOBAL' && key !== 'root') {
					this.addGlobalInfo(key);
				}
			}
		}

		// Prototype of syntax desugaring can't change across inspector invocations
		// these values can be cached once and reused across avery run.

		// Add entries to allow proper serialization over generators and iterators.
		const emptyGenerator = function* (): any {};

		this.cache.add(Object.getPrototypeOf(emptyGenerator), {
			type: 'expr',
			value: 'Object.getPrototypeOf(function*(){})',
		});
		this.cache.add(Object.getPrototypeOf(emptyGenerator.prototype), {
			type: 'expr',
			value: 'Object.getPrototypeOf((function*(){}).prototype)',
		});
		this.cache.add(Symbol.iterator, { type: 'expr', value: 'Symbol.iterator' });

		this.cache.add(process.env, Entry.expr('process.env'));
	}

	private addGlobalInfo(key: string) {
		const globalObj = (global as any)[key];
		const text = utils.isLegalMemberName(key) ? `global.${key}` : `global[${JSON.stringify(key)}]`;

		if (globalObj !== undefined && globalObj !== null) {
			this.cache.add(globalObj, { type: 'expr', value: text });
			this.cache.add(Object.getPrototypeOf(globalObj), {
				type: 'expr',
				value: `Object.getPrototypeOf(${text})`,
			});
			this.cache.add(globalObj.prototype, {
				type: 'expr',
				value: `${text}.prototype`,
			});
		}
	}
}
