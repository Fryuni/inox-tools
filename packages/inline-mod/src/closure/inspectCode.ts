import * as modules from 'node:module';
import * as upath from 'node:path';
import { Entry, EntryRegistry } from './entry.js';
import { Lazy } from './lazy.js';
import { getModuleFromPath } from './package.js';
import {
	parseFunction,
	type CapturedPropertyChain,
	type CapturedVariables,
} from './parseFunction.js';
import { rewriteSuperReferences } from './rewriteSuper.js';
import { InspectedFunction, type PropertyInfo, type PropertyMap } from './types.js';
import * as utils from './utils.js';
import * as v8 from './v8.js';

interface ContextFrame {
	// TODO: Add reporting for function location
	// functionLocation?: FunctionLocation;
	capturedFunctionName?: string;
	capturedVariableName?: string;
	isArrowFunction?: boolean;
	captureModule?: { name: string; value: any };
}

const serializationInspectors = new WeakMap<Function, Inspector>();

const alwaysSerialize = (_: unknown) => true;

/** @internal */
export function getInspector(serializeFn: (val: unknown) => boolean = alwaysSerialize): Inspector {
	const cached = serializationInspectors.get(serializeFn);
	if (cached) {
		return cached;
	}

	const inspector = new Inspector(serializeFn);
	serializationInspectors.set(serializeFn, inspector);
	return inspector;
}

// Prevent capture from recursing into the inspection logic.
// This function and all the tooling it refer to cannot be serialized.
(getInspector as any).doNotCapture = true;

class InspectionError extends Error {
	public constructor(message: string, frames?: ContextFrame[]) {
		super(message);
		if (frames) {
			let stack = message + '\nWhile inspecting:';
			for (let i = frames.length - 1; i >= 0; i--) {
				const frame = frames[i];

				stack += '\n    ';

				if (i !== frames.length - 1) {
					stack += 'in ';
				}

				if (frame.capturedFunctionName) {
					stack += frame.capturedFunctionName;
				} else if (frame.capturedVariableName) {
					stack += frame.capturedVariableName;
				} else if (frame.captureModule) {
					stack += frame.captureModule.name;
				} else if (frame.isArrowFunction) {
					stack += 'anonymous function';
				} else {
					stack += 'unknown';
				}
			}

			this.stack = stack;
		}
	}
}

/**
 * @internal
 */
class Inspector {
	public static doNotCapture = true;

	// The cache stores a map of objects to the entries we've created for them.  It's used so that
	// we only ever create a single environemnt entry for a single object. i.e. if we hit the same
	// object multiple times while walking the memory graph, we only emit it once.
	public readonly cache = GlobalCache.fork();

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

	public constructor(private readonly serialize: (o: unknown) => boolean) {}

	public async inspect(
		value: unknown,
		capturedProperties?: CapturedPropertyChain[]
	): Promise<Entry> {
		try {
			return await this.unsafeInspect(value, capturedProperties);
		} catch (error) {
			if (error instanceof InspectionError) {
				throw error;
			}

			throw new InspectionError(error instanceof Error ? error.message : `${error}`, this.frames);
		}
	}

	public async unsafeInspect(
		value: unknown,
		capturedProperties?: CapturedPropertyChain[]
	): Promise<Entry> {
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
			case 'bigint':
				return Entry.expr(`${value}n`);
			case 'symbol':
				return Entry.expr(`Symbol.for(${JSON.stringify(value.description)})`);
		}

		if (value instanceof RegExp) {
			return Entry.regexp(value);
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
					await this.inspectObject(value, capturedProperties);
				}
				return entry;
			}
		}

		this.cache.prepare(value);

		const entry: Entry = await this.inspectComplex(value, capturedProperties);

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

	private async inspectComplex(
		value: object,
		capturedProperties?: CapturedPropertyChain[]
	): Promise<Entry> {
		if (this.doNotCapture(value)) {
			return Entry.json();
		}

		const normalizedModuleName = await findNormalizedModuleName(value);
		if (normalizedModuleName) {
			return this.captureModule(normalizedModuleName);
		}

		if (value instanceof Function) {
			return this.inspectFunction(value);
		}

		if (value instanceof Promise) {
			const val = await value;
			return {
				type: 'promise',
				value: await this.inspect(val),
			};
		}

		if (Array.isArray(value)) {
			const array: Entry[] = [];
			for (const descriptor of getOwnPropertyDescriptors(value)) {
				// Property descriptors are note properly typed in TS
				array[descriptor.name as unknown as number] = await this.inspect(
					getOwnProperty(value, descriptor)
				);
			}

			return Entry.array(array);
		}

		if (Object.prototype.toString.call(value) === '[object Arguments]') {
			// From: https://stackoverflow.com/questions/7656280/how-do-i-check-whether-an-object-is-an-arguments-object-in-javascript
			const array: Entry[] = [];
			for (const elem of value as unknown[]) {
				array.push(await this.inspect(elem));
			}

			return Entry.array(array);
		}

		return this.inspectObject(value, capturedProperties);
	}

	private async inspectObject(
		obj: NonNullable<object>,
		capturedProperties: CapturedPropertyChain[] = []
	): Promise<Entry<'object'>> {
		const [entry, serializeAll] = await this.serializeObjectWorker(obj, capturedProperties);
		if (capturedProperties.length !== 0 && serializeAll) {
			// Object was not fully serialized, but that is needed. Serialize again with all properties.
			const [fullEntry] = await this.serializeObjectWorker(obj, []);
			return fullEntry;
		}

		return entry;
	}

	private async serializeObjectWorker(
		obj: NonNullable<object>,
		_capturedProperties: CapturedPropertyChain[]
	): Promise<[Entry<'object'>, boolean]> {
		// TODO: Add optimization for capturing the minimal referenced subset of an object.

		// if (capturedProperties.length === 0) {
		const entry = await this.serializeAllObjectProperties(obj);

		return [entry, false];
		// }

		// const [newInspection, serializeAll] = await this.serializeObjectProperties(
		// 	obj,
		// 	capturedProperties
		// );
		// Object.assign(entry.value, newInspection);

		// return [entry, serializeAll];
	}

	private async serializeAllObjectProperties(obj: NonNullable<object>): Promise<Entry<'object'>> {
		const entry = this.loadObjectEntry(obj);

		// we wanted to capture everything (including the prototype chain)
		const descriptors = getOwnPropertyDescriptors(obj);

		for (const descriptor of descriptors) {
			const keyEntry = await this.inspect(getNameOrSymbol(descriptor));

			// We're about to recurse inside this object. In order to prevent infinite loops, put a
			// dummy entry in the environment map.  That way, if we hit this object again while
			// recursing we won't try to generate this property.
			//
			// Note: we only stop recursing if we hit exactly our sentinel key (i.e. we're self
			// recursive).  We *do* want to recurse through the object again if we see it through
			// non-recursive paths.  That's because we might be hitting this object through one
			// prop-name-path, but we created it the first time through another prop-name path.
			//
			// By processing the object again, we will add the different members we need.
			if (entry.value.env.has(keyEntry) && entry.value.env.get(keyEntry) === undefined) {
				continue;
			}
			entry.value.env.set(keyEntry, undefined as any);

			const propertyInfo = await this.createPropertyInfo(descriptor);
			const prop = getOwnProperty(obj, descriptor);
			const valEntry = await this.inspect(prop);

			// Now, replace the dummy entry with the actual one we want.
			entry.value.env.set(keyEntry, { info: propertyInfo, entry: valEntry });
		}

		// If the object's __proto__ is not Object.prototype, then we have to capture what it
		// actually is.  On the other end, we'll use Object.create(deserializedProto) to set
		// things up properly.
		//
		// We don't need to capture the prototype if the user is not capturing 'this' either.
		if (!entry.value.proto) {
			const proto = Object.getPrototypeOf(obj);
			if (proto !== Object.prototype) {
				entry.value.proto = await this.inspect(proto);
			}
		}

		return entry;
	}

	private loadObjectEntry(obj: NonNullable<object>): Entry<'object'> {
		const existingEntry = this.cache.lookup(obj);

		if (existingEntry === undefined) {
			const newEntry: Entry<'object'> = {
				type: 'object',
				value: {
					env: new Map(),
				},
			};
			this.cache.add(obj, newEntry);
			return newEntry;
		}

		switch (existingEntry.type) {
			case 'object':
				return existingEntry;
			case 'pending': {
				this.cache.add(obj, {
					type: 'object',
					value: {
						env: new Map(),
					},
				});

				// Cache will turn the existing entry into the new entry.
				return existingEntry as unknown as Entry<'object'>;
			}
			default:
				throw new Error('Mismatching entry in cache');
		}
	}

	private async inspectFunction(func: Function): Promise<Entry<'function'>> {
		if (utils.hasTrueBooleanMember(func, 'doNotCapture')) {
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
				this.simpleFunctions.push(entry);
			}
		}

		return entry;
	}

	private async serializeWorker(func: Function): Promise<InspectedFunction> {
		const funcEntry = this.cache.preparedLookup(func);
		const frame = this.frames.at(-1)!;
		const functionString = func.toString();

		const [error, parsedFunction] = parseFunction(functionString);
		if (error) {
			this.throwSerializableError(error);
		}

		frame.isArrowFunction = parsedFunction.isArrowFunction;
		const { funcExprWithName, functionDeclarationName } = parsedFunction;

		const capturedValues: PropertyMap = await this.processCapturedVariables(
			func,
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
				await this.processDerivedClassConstructor(func, protoEntry);

				// Because this was was class constructor function, rewrite any 'super' references
				// in it do its derived type if it has one.
				functionInfo.code = rewriteSuperReferences(funcExprWithName!, /*isStatic*/ false);
			}
		}

		// Capture any property on the function itself.
		for (const descriptor of getOwnPropertyDescriptors(func)) {
			if (descriptor.name === 'length' || descriptor.name === 'name') {
				// Do not capture `length` and `name` properties since those cannot
				// be changed anyway.
				continue;
			}

			const funcProp = getOwnProperty(func, descriptor);

			if (descriptor.name === 'prototype' && isDefaultFunctionPrototype(func, funcProp)) {
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

			functionInfo.code = rewriteSuperReferences(
				funcExprWithName!,
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

	private async processDerivedClassConstructor(func: Function, protoEntry: Entry): Promise<void> {
		// Map from derived class' constructor and members, to the entry for the base class (i.e.
		// the base class' constructor function). We'll use this when serializing out those members
		// to rewrite any usages of 'super' appropriately.

		// We're processing the derived class constructor itself.  Just map it directly to the base
		// class function.
		this.classInstanceMemberToSuperEntry.add(func, protoEntry);

		const addIfFunction = (prop: any, isStatic: boolean) => {
			if (prop instanceof Function) {
				const set = isStatic
					? this.classStaticMemberToSuperEntry
					: this.classInstanceMemberToSuperEntry;
				set.add(prop, protoEntry);
			}
		};

		// Also, make sure our methods can also find this entry so they too can refer to
		// 'super'.
		for (const descriptor of getOwnPropertyDescriptors(func)) {
			if (
				descriptor.name !== 'length' &&
				descriptor.name !== 'name' &&
				descriptor.name !== 'prototype'
			) {
				// static method.
				const classProp = getOwnProperty(func, descriptor);
				addIfFunction(classProp, /*isStatic*/ true);
			}
		}

		for (const descriptor of getOwnPropertyDescriptors(func.prototype)) {
			// instance method.
			const classProp = getOwnProperty(func.prototype, descriptor);
			addIfFunction(classProp, /*isStatic*/ false);
		}
	}

	private async captureModule(normalizedModuleName: string): Promise<Entry<'module' | 'object'>> {
		// Splitting on "/" is safe to do as this module name is already in a normalized form.
		const moduleParts = normalizedModuleName.split('/');

		const nodeModulesSegment = 'node_modules';
		const nodeModulesSegmentIndex = moduleParts.findIndex((v) => v === nodeModulesSegment);
		const isInNodeModules = nodeModulesSegmentIndex >= 0;

		// If the path goes into node_modules, strip off the node_modules part. This will help
		// ensure that lookup of those modules will work on the cloud-side even if the module
		// isn't in a relative node_modules directory.  For example, this happens with aws-sdk.
		// It ends up actually being in /var/runtime/node_modules inside aws lambda.
		//
		// This also helps ensure that modules that are 'yarn link'ed are found properly. The
		// module path we have may be on some non-local path due to the linking, however this
		// will ensure that the module-name we load is a simple path that can be found off the
		// node_modules that we actually upload with our serialized functions.
		return {
			type: 'module',
			value: {
				type: 'star',
				reference: isInNodeModules
					? getModuleFromPath(upath.join(...moduleParts.slice(nodeModulesSegmentIndex + 1)))
					: normalizedModuleName,
			},
		};
	}

	private async processCapturedVariables(
		func: Function,
		capturedVariables: CapturedVariables
	): Promise<PropertyMap> {
		const capturedValues: PropertyMap = new Map();

		for (const scope of ['required', 'optional'] as const) {
			for (const [name, properties] of capturedVariables[scope].entries()) {
				const value = await v8.lookupCapturedVariableValue(func, name, scope === 'required');

				const moduleName = await findNormalizedModuleName(value);
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
				const serializedValue = await this.inspect(value, properties);

				capturedValues.set(serializedName, { entry: serializedValue });

				while (this.frames.length > frameLength) {
					// Pop the frames until we are back where we begun.
					this.frames.pop();
				}
			}
		}

		return capturedValues;
	}

	private async createPropertyInfo(descriptor: ClosurePropertyDescriptor): Promise<PropertyInfo> {
		const propertyInfo: PropertyInfo = { hasValue: descriptor.value !== undefined };
		propertyInfo.configurable = descriptor.configurable;
		propertyInfo.enumerable = descriptor.enumerable;
		propertyInfo.writable = descriptor.writable;

		if (descriptor.get) {
			propertyInfo.get = await this.inspect(descriptor.get);
		}

		if (descriptor.set) {
			propertyInfo.set = await this.inspect(descriptor.set);
		}

		return propertyInfo;
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

		if (utils.hasTrueBooleanMember(value, 'doNotCapture')) {
			return true;
		}

		if (value instanceof Function && isDerivedNoCaptureConstructor(value)) {
			// constructor derived from something that should not be captured
			return true;
		}

		return false;
	}

	private throwSerializableError(info: string): never {
		throw new InspectionError(info, this.frames);
	}
}

interface ClosurePropertyDescriptor {
	/** name of the property for a normal property. either 'name' or 'symbol' will be present.  but not both. */
	name?: string;
	/** symbol-name of the property.  either 'name' or 'symbol' will be present.  but not both. */
	symbol?: symbol;

	configurable?: boolean;
	enumerable?: boolean;
	value?: any;
	writable?: boolean;
	get?: () => any;
	set?: (v: any) => void;
}

function createClosurePropertyDescriptor(
	nameOrSymbol: string | symbol,
	descriptor: PropertyDescriptor
): ClosurePropertyDescriptor {
	if (nameOrSymbol === undefined) {
		throw new Error('Was not given a name or symbol');
	}

	const copy: ClosurePropertyDescriptor = { ...descriptor };
	if (typeof nameOrSymbol === 'string') {
		copy.name = nameOrSymbol;
	} else {
		copy.symbol = nameOrSymbol;
	}

	return copy;
}

function getOwnPropertyDescriptors(obj: any): ClosurePropertyDescriptor[] {
	const result: ClosurePropertyDescriptor[] = [];

	for (const name of Object.getOwnPropertyNames(obj)) {
		if (name === '__proto__') {
			// don't return prototypes here.  If someone wants one, they should call
			// Object.getPrototypeOf. Note: this is the standard behavior of
			// Object.getOwnPropertyNames.  However, the Inspector API returns these, and we want to
			// filter them out.
			continue;
		}

		const descriptor = Object.getOwnPropertyDescriptor(obj, name);
		if (!descriptor) {
			throw new Error(`Could not get descriptor for ${name} on: ${JSON.stringify(obj)}`);
		}

		result.push(createClosurePropertyDescriptor(name, descriptor));
	}

	for (const symbol of Object.getOwnPropertySymbols(obj)) {
		const descriptor = Object.getOwnPropertyDescriptor(obj, symbol);
		if (!descriptor) {
			throw new Error(
				`Could not get descriptor for symbol ${symbol.toString()} on: ${JSON.stringify(obj)}`
			);
		}

		result.push(createClosurePropertyDescriptor(symbol, descriptor));
	}

	return result;
}

function getNameOrSymbol(descriptor: ClosurePropertyDescriptor): symbol | string {
	if (descriptor.symbol === undefined && descriptor.name === undefined) {
		throw new Error("Descriptor didn't have symbol or name: " + JSON.stringify(descriptor));
	}

	return descriptor.symbol || descriptor.name!;
}

function getOwnProperty(obj: any, descriptor: ClosurePropertyDescriptor): any {
	return descriptor.get || descriptor.set ? undefined : obj[getNameOrSymbol(descriptor)];
}

function isDefaultFunctionPrototype(func: Function, prototypeProp: any): boolean {
	// The initial value of prototype on any newly-created Function instance is a new instance of
	// Object, but with the own-property 'constructor' set to point back to the new function.
	if (prototypeProp && prototypeProp.constructor === func) {
		const descriptors = getOwnPropertyDescriptors(prototypeProp);
		return descriptors.length === 1 && descriptors[0].name === 'constructor';
	}

	return false;
}

const bannedBuiltInModules = new Set<string>([
	// Deprecated modules
	'_stream_wrap',
	'sys',

	// References to WASI module can't be serialized at the moment.
	'wasi',
]);

const builtInModules = Lazy.of(async () => {
	return new Map(
		await Promise.all(
			modules.builtinModules
				.filter(name => !bannedBuiltInModules.has(name))
				.map(
					async (name) => [await import(/* @vite-ignore */ `node:${name}`), name] as const
				)
		)
	);
});

type ModuleCache = {
	id: string;
	exports: any;
	loaded: boolean;
};

// findNormalizedModuleName attempts to find a global name bound to the object, which can be used as
// a stable reference across serialization.  For built-in modules (i.e. "os", "fs", etc.) this will
// return that exact name of the module.  Otherwise, this will return the relative path to the
// module from the current working directory of the process.  This will normally be something of the
// form ./node_modules/<package_name>...
//
// This function will also always return modules in a normalized form (i.e. all path components will
// be '/').
async function findNormalizedModuleName(obj: any): Promise<string | undefined> {
	// First, check the built-in modules
	const builtInMods = await builtInModules.get();
	const key = builtInMods.get(obj);
	if (key) {
		return key;
	}

	// Next, check the Node module cache, which will store cached values
	// of all non-built-in Node modules loaded by the program so far. _Note_: We
	// don't pre-compute this because the require cache will get populated
	// dynamically during execution.
	for (const mod of Object.values<ModuleCache>((modules as any)._cache)) {
		if (Object.is(mod.exports, obj)) {
			// Rewrite the path to be a local module reference relative to the current working
			// directory.
			const modPath = upath.relative(process.cwd(), mod.id);
			return './' + modPath;
		}
	}

	// Else, return that no global name is available for this object.
	return undefined;
}

// Is this a constructor derived from a noCapture constructor.  if so, we don't want to
// emit it.  We would be unable to actually hook up the "super()" call as one of the base
// constructors was set to not be captured.
function isDerivedNoCaptureConstructor(func: Function): boolean {
	for (let current: any = func; current; current = Object.getPrototypeOf(current)) {
		if (utils.hasTrueBooleanMember(current, 'doNotCapture')) {
			return true;
		}
	}

	return false;
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

		this.cache.addUnchecked(Object.getPrototypeOf(emptyGenerator), {
			type: 'expr',
			value: 'Object.getPrototypeOf(function*(){})',
		});
		this.cache.addUnchecked(Object.getPrototypeOf(emptyGenerator.prototype), {
			type: 'expr',
			value: 'Object.getPrototypeOf((function*(){}).prototype)',
		});
		this.cache.addUnchecked(Symbol.iterator, { type: 'expr', value: 'Symbol.iterator' });

		this.cache.addUnchecked(process.env, Entry.expr('process.env'));
	}

	private addGlobalInfo(key: string) {
		const globalObj = (global as any)[key];
		const text = utils.isLegalMemberName(key) ? `global.${key}` : `global[${JSON.stringify(key)}]`;

		if (globalObj !== undefined && globalObj !== null) {
			this.cache.addUnchecked(globalObj, { type: 'expr', value: text });
			this.cache.addUnchecked(Object.getPrototypeOf(globalObj), {
				type: 'expr',
				value: `Object.getPrototypeOf(${text})`,
			});
			this.cache.addUnchecked(globalObj.prototype, {
				type: 'expr',
				value: `${text}.prototype`,
			});
		}
	}
}
