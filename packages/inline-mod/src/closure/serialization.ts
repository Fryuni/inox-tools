// Copyright 2016-2018, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { Entry } from './entry.js';
import {
	InspectedFunction,
	InspectedObject,
	PropertyInfo,
	PropertyInfoAndValue,
	PropertyMap,
} from './types.js';
import * as utils from './utils.js';

/** @internal */
export interface ModEntry {
	constExports?: Record<string, Entry>;
	defaultExport?: Entry;
	assignExport?: Entry;
}

/** @internal */
export interface SerializedModule {
	text: string;
}

/**
 * serializeModule serializes an ECMAScript module into a text form that can be loaded in another execution context,
 * for example as part of a virtual module in a bundler. The module serialization captures any
 * variables captured by the functions it refers to and serializes those values into the generated text along with the
 * module. This process is recursive, so that functions referenced by the body of a serialized function will themselves
 * be serialized as well. This process also deeply serializes captured object values, including prototype chains and
 * property descriptors, such that the semantics of the function when deserialized should match the original function.
 *
 * There are several known limitations:
 * - If a native function is captured either directly or indirectly, closure serialization will return an error.
 * - Captured values will be serialized based on their values at the time that `serializeFunction` is called.  Mutations
 *   to these values after that (but before the deserialized function is used) will not be observed by the deserialized
 *   function.
 */
export async function serializeModule(modEntry: ModEntry): Promise<SerializedModule> {
	return ModuleSerializer.serialize(modEntry);
}

class ModuleSerializer {
	/**
	 * Mapping of entries to the name they are bound to.
	 */
	private readonly envEntryToEnvVar = new Map<Entry, string>();

	/**
	 * Set of all variable names added to the environment.
	 * In case of a collision, new entries will receive a different name.
	 */
	private readonly envVarNames = new Set<string>();
	private readonly functionInfoToEnvVar = new Map<InspectedFunction, string>();

	/**
	 * Set of targets whose code have already beeing emitted.
	 */
	private readonly emittedTargets = new Set<Entry | InspectedObject>();

	private importCode = '';

	private environmentCode = '';

	public static serialize(entry: ModEntry): SerializedModule {
		return new this().serialize(entry);
	}

	private serialize(entry: ModEntry): SerializedModule {
		let exportCode = '';

		if (entry.assignExport) {
			const ref = this.envEntryToString(entry.assignExport, 'modExport');
			exportCode += `export = ${ref};\n`;
		}

		if (entry.defaultExport) {
			const ref = this.envEntryToString(entry.defaultExport, 'defaultExport');
			exportCode += `export default ${ref};`;
		}

		for (const [key, exportEntry] of Object.entries(entry.constExports ?? {})) {
			if (!utils.isLegalFunctionName(key)) {
				throw new Error(`Exported const cannot have name "${key}", use assign export for that.`);
			}

			const ref = this.envEntryToString(exportEntry, key);
			exportCode += `export const ${key} = ${ref}`;
		}

		return {
			text: [this.importCode, this.environmentCode, exportCode].join('\n'),
		};
	}

	private envEntryToString(envEntry: Entry, varName: string): string {
		const envVar = this.envEntryToEnvVar.get(envEntry);
		if (envVar !== undefined) {
			return envVar;
		}

		// Complex objects may also be referenced from multiple functions.  As such, we have to
		// create variables for them in the environment so that all references to them unify to the
		// same reference to the env variable.  Effectively, we need to do this for any object that
		// could be compared for reference-identity.  Basic types (strings, numbers, etc.) have
		// value semantics and this can be emitted directly into the code where they are used as
		// there is no way to observe that you are getting a different copy.
		if (isObjOrArrayOrRegExp(envEntry)) {
			return this.complexEnvEntryToString(envEntry, varName);
		} else {
			// Other values (like strings, bools, etc.) can just be emitted inline.
			return this.simpleEnvEntryToString(envEntry, varName);
		}
	}

	private simpleEnvEntryToString(envEntry: Entry, varName: string): string {
		switch (envEntry.type) {
			case 'json':
				return JSON.stringify(envEntry.value);
			case 'function':
				return this.emitFunctionAndGetName(envEntry);
			case 'module':
				return this.emitModule(envEntry, varName);
			case 'promise':
				return `Promise.resolve(${this.envEntryToString(envEntry.value, varName)})`;
			case 'expr':
				return envEntry.value;
			default:
				throw new Error('Not a simple entry.');
		}
	}

	private complexEnvEntryToString(envEntry: Entry, varName: string): string {
		// Call all environment variables __e<num> to make them unique.  But suffix
		// them with the original name of the property to help provide context when
		// looking at the source.
		const envVar = this.createEnvVarName(varName, /*addIndexAtEnd:*/ false);
		this.envEntryToEnvVar.set(envEntry, envVar);

		switch (envEntry.type) {
			case 'object':
				this.emitObject(envVar, envEntry, varName);
				break;
			case 'array':
				this.emitArray(envVar, envEntry, varName);
				break;
			case 'regexp': {
				const { source, flags } = envEntry.value;
				const regexVal = `new RegExp(${JSON.stringify(source)}, ${JSON.stringify(flags)})`;
				const entryString = `var ${envVar} = ${regexVal};\n`;

				this.emitCode(envEntry, entryString);
			}
		}

		return envVar;
	}

	private emitModule(entry: Entry<'module'>, varName: string): string {
		const modName = this.createEnvVarName(varName, /* addIndexAtEnd */ true);

		this.envEntryToEnvVar.set(entry, modName);

		const importPrefix = entry.value.type === 'default' ? 'import' : 'import * as';

		this.importCode += `${importPrefix} ${modName} from '${entry.value.reference}';`;

		return modName;
	}

	private emitFunctionAndGetName(entry: Entry<'function'>): string {
		// If this is the first time seeing this function, then actually emit the function code for
		// it.  Otherwise, just return the name of the emitted function for anyone that wants to
		// reference it from their own code.
		let functionName = this.functionInfoToEnvVar.get(entry.value);
		if (!functionName) {
			functionName = entry.value.name
				? this.createEnvVarName(entry.value.name, /*addIndexAtEnd:*/ false)
				: this.createEnvVarName('f', /*addIndexAtEnd:*/ true);
			this.functionInfoToEnvVar.set(entry.value.name, functionName);

			this.emitFunctionWorker(entry, functionName);
		}

		return functionName;
	}

	private emitFunctionWorker(entry: Entry<'function'>, varName: string) {
		const inspectedFunction = entry.value;
		const capturedValues = this.envFromEnvObj(inspectedFunction.capturedValues);

		const thisCapture = capturedValues.this;
		const argumentsCapture = capturedValues.arguments;

		capturedValues.this = undefined as unknown as string;
		capturedValues.arguments = undefined as unknown as string;

		const parameters = [...Array(inspectedFunction.paramCount)]
			.map((_, index) => `__${index}`)
			.join(', ');

		// for (const [keyEntry, { entry: valEntry }] of functionInfo.capturedValues) {
		// 	if (keyEntry.type !== 'json' || typeof keyEntry.value !== 'string') {
		// 	  throw new Error('Invalid key entry for a captured value.');
		// 	}
		//
		// 	if (valEntry.type === 'module') {
		// 		delete capturedValues[keyEntry.json];
		// 	}
		// }

		let functionText =
			'function ' +
			varName +
			'(' +
			parameters +
			') {\n' +
			'  return (function() {\n' +
			'    with(' +
			envObjToString(capturedValues) +
			') {\n\n' +
			'return ' +
			inspectedFunction.code +
			';\n\n' +
			'    }\n' +
			'  }).apply(' +
			thisCapture +
			', ' +
			argumentsCapture +
			').apply(this, arguments);\n' +
			'}\n';

		// If this function is complex (i.e. non-default __proto__, or has properties, etc.)
		// then emit those as well.
		this.emitComplexObjectProperties(varName, varName, inspectedFunction);

		if (inspectedFunction.proto !== undefined) {
			const protoVar = this.envEntryToString(inspectedFunction.proto, `${varName}_proto`);
			functionText += `Object.setPrototypeOf(${varName}, ${protoVar});\n`;
		}

		this.emitCode(entry, functionText);
	}

	private emitObject(envVar: string, entry: Entry<'object'>, varName: string): void {
		const obj = entry.value;
		const complex = isComplex(obj);

		if (complex) {
			// we have a complex child.  Because of the possibility of recursion in
			// the object graph, we have to spit out this variable uninitialized first.
			// Then we can walk our children, creating a single assignment per child.
			// This way, if the child ends up referencing us, we'll have already emitted
			// the **initialized** variable for them to reference.
			if (obj.proto) {
				const protoVar = this.envEntryToString(obj.proto, `${varName}_proto`);
				this.emitCode(entry, `var ${envVar} = Object.create(${protoVar});\n`);
			} else {
				this.emitCode(entry, `var ${envVar} = {};\n`);
			}

			this.emitComplexObjectProperties(envVar, varName, obj);
		} else {
			// All values inside this obj are simple.  We can just emit the object
			// directly as an object literal with all children embedded in the literal.
			const props: string[] = [];

			for (const [keyEntry, { entry: valEntry }] of obj.env) {
				const keyName =
					keyEntry.type === 'json' && typeof keyEntry.value === 'string' ? keyEntry.json : 'sym';
				const propVal = this.simpleEnvEntryToString(valEntry, keyName);

				if (
					keyEntry.type === 'json' &&
					typeof keyEntry.value === 'string' &&
					utils.isLegalMemberName(keyEntry.json)
				) {
					props.push(`${keyEntry.json}: ${propVal}`);
				} else {
					const propName = this.envEntryToString(keyEntry, keyName);
					props.push(`[${propName}]: ${propVal}`);
				}
			}

			const allProps = props.join(', ');
			const entryString = `var ${envVar} = {${allProps}};\n`;
			this.emitCode(entry, entryString);
		}
	}

	private emitComplexObjectProperties(
		envVar: string,
		varName: string,
		inspectedObj: InspectedObject
	): void {
		let entriesCode = '';

		for (const [keyEntry, { info, entry: valEntry }] of inspectedObj.env) {
			const subName =
				keyEntry.type === 'json' && typeof keyEntry.value === 'string' ? keyEntry.value : 'sym';

			const valString = this.envEntryToString(valEntry, varName + '_' + subName);

			if (isSimplePropertyInfo(info)) {
				// normal property.  Just emit simply as a direct assignment.
				if (
					keyEntry.type === 'json' &&
					typeof keyEntry.value === 'string' &&
					utils.isLegalMemberName(keyEntry.value)
				) {
					entriesCode += `${envVar}.${keyEntry.value} = ${valString};\n`;
				} else {
					const keyString = this.envEntryToString(keyEntry, varName + '_' + subName);
					entriesCode += `${envVar}${`[${keyString}]`} = ${valString};\n`;
				}
			} else {
				const keyString = this.envEntryToString(keyEntry, varName + '_' + subName);
				// complex property.  emit as Object.defineProperty
				entriesCode += this.generateDefineProperty({
					parentName: envVar,
					varName: varName,
					desc: info!,
					entryValue: valString,
					propName: keyString,
				});
			}
		}

		this.emitCode(inspectedObj, entriesCode);
	}

	private generateDefineProperty(options: {
		parentName: string;
		varName: string;
		desc: PropertyInfo;
		entryValue: string;
		propName: string;
	}): string {
		const { parentName, varName, desc, entryValue, propName } = options;
		const copy: any = {};
		if (desc.configurable) {
			copy.configurable = desc.configurable;
		}
		if (desc.enumerable) {
			copy.enumerable = desc.enumerable;
		}
		if (desc.writable) {
			copy.writable = desc.writable;
		}
		if (desc.get) {
			copy.get = this.envEntryToString(desc.get, `${varName}_get`);
		}
		if (desc.set) {
			copy.set = this.envEntryToString(desc.set, `${varName}_set`);
		}
		if (desc.hasValue) {
			copy.value = entryValue;
		}

		return `Object.defineProperty(${parentName}, ${propName}, ${envObjToString(copy)});\n`;
	}

	private emitArray(envVar: string, entry: Entry<'array'>, varName: string): void {
		const arr = entry.value;
		if (arr.some(deepContainsObjOrArrayOrRegExp) || isSparse(arr) || hasNonNumericIndices(arr)) {
			// we have a complex child.  Because of the possibility of recursion in the object
			// graph, we have to spit out this variable initialized (but empty) first. Then we can
			// walk our children, knowing we'll be able to find this variable if they reference it.
			let emitCode = `var ${envVar} = [];\n`;

			// Walk the names of the array properties directly. This ensures we work efficiently
			// with sparse arrays.  i.e. if the array has length 1k, but only has one value in it
			// set, we can just set that value, instead of setting 999 undefineds.
			for (const key of Object.getOwnPropertyNames(arr)) {
				if (key !== 'length') {
					const entryString = this.envEntryToString(arr[<any>key], `${varName}_${key}`);
					emitCode += `${envVar}${isNumeric(key) ? `[${key}]` : `.${key}`} = ${entryString};\n`;
				}
			}

			this.emitCode(entry, emitCode);
		} else {
			// All values inside this array are simple.  We can just emit the array elements in
			// place.  i.e. we can emit as ``var arr = [1, 2, 3]`` as that's far more preferred than
			// having four individual statements to do the same.
			const strings: string[] = [];
			for (let i = 0, n = arr.length; i < n; i++) {
				strings.push(this.simpleEnvEntryToString(arr[i], `${varName}_${i}`));
			}

			this.emitCode(entry, `var ${envVar} = [${strings.join(', ')}];\n`);
		}
	}

	private createEnvVarName(baseName: string, addIndexAtEnd: boolean): string {
		const trimLeadingUnderscoreRegex = /^_*/g;
		const legalName = makeLegalJSName(baseName).replace(trimLeadingUnderscoreRegex, '');
		let index = 0;

		let currentName = addIndexAtEnd ? '__' + legalName + index : '__' + legalName;
		while (this.envVarNames.has(currentName)) {
			currentName = addIndexAtEnd ? '__' + legalName + index : '__' + index + '_' + legalName;
			index++;
		}

		this.envVarNames.add(currentName);
		return currentName;
	}

	private envFromEnvObj(env: PropertyMap): Record<string, string> {
		const envObj: Record<string, string> = {};

		for (const [keyEntry, { entry: valEntry }] of env) {
			if (keyEntry.type !== 'json' && typeof keyEntry.value !== 'string') {
				throw new Error('PropertyMap key was not a string.');
			}

			envObj[keyEntry.value] = this.envEntryToString(valEntry, keyEntry.value);
		}

		return envObj;
	}

	private emitCode(entry: Entry | InspectedObject, code: string): void {
		if (this.emittedTargets.has(entry)) {
			// Sanity check
			throw new Error('Code emitted twice for the same entry');
		}

		this.emittedTargets.add(entry);

		if (code) {
			this.environmentCode += code;
		}
	}
}

const makeLegalRegex = /[^0-9a-zA-Z_]/g;
function makeLegalJSName(n: string) {
	return n.replace(makeLegalRegex, (_) => '');
}

function isSparse<T>(arr: Array<T>) {
	// getOwnPropertyNames for an array returns all the indices as well as 'length'.
	// so we subtract one to get all the real indices.  If that's not the same as
	// the array length, then we must have missing properties and are thus sparse.
	return arr.length !== Object.getOwnPropertyNames(arr).length - 1;
}

function hasNonNumericIndices<T>(arr: Array<T>) {
	return Object.keys(arr).some((k) => k !== 'length' && !isNumeric(k));
}

function isNumeric(n: string) {
	return !isNaN(parseFloat(n)) && isFinite(+n);
}

function isObjOrArrayOrRegExp(env: Entry): boolean {
	switch (env.type) {
		case 'object':
		case 'array':
		case 'regexp':
			return true;
		default:
			return false;
	}
}

function isComplex(obj: InspectedObject) {
	if (obj.proto !== undefined) {
		return true;
	}

	for (const v of obj.env.values()) {
		if (entryIsComplex(v)) {
			return true;
		}
	}

	return false;
}

function entryIsComplex(v: PropertyInfoAndValue) {
	return !isSimplePropertyInfo(v.info) || deepContainsObjOrArrayOrRegExp(v.entry);
}

function isSimplePropertyInfo(info?: PropertyInfo): boolean {
	if (!info) {
		return true;
	}

	return (
		info.enumerable === true &&
		info.writable === true &&
		info.configurable === true &&
		!info.get &&
		!info.set
	);
}

function deepContainsObjOrArrayOrRegExp(env: Entry): boolean {
	return (
		isObjOrArrayOrRegExp(env) ||
		(env.type === 'object' && deepContainsObjOrArrayOrRegExp(env.value)) ||
		(env.type !== 'promise' && deepContainsObjOrArrayOrRegExp(env.value))
	);
}

/**
 * Converts an environment object into a string which can be embedded into a serialized function
 * body.  Note that this is not JSON serialization, as we may have property values which are
 * variable references to other global functions. In other words, there can be free variables in the
 * resulting object literal.
 *
 * @param envObj The environment object to convert to a string.
 */
function envObjToString(envObj: Record<string, string>): string {
	return `{ ${Object.keys(envObj)
		.map((k) => `${k}: ${envObj[k]}`)
		.join(', ')} }`;
}
