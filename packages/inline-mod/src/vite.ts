import { magicFactory } from './closure/inspectCode.js';
import { InlineModuleError } from './closure/types.js';
import { inspectInlineMod, type InlineModule, type ModuleOptions } from './inlining.js';

const modRegistry = new Map<string, Promise<InlineModule>>();

class InlineModulePluginError extends InlineModuleError {}

export function factory<T>(factoryFn: () => T): T {
	return magicFactory({
		isAsync: false,
		fn: factoryFn,
	});
}

export function asyncFactory<T>(factoryFn: () => Promise<T>): Promise<T> {
	return magicFactory({
		isAsync: true,
		fn: factoryFn,
	});
}

let inlineModuleCounter = 0;

export function inlineModule(options: ModuleOptions): string {
	const moduleId = `inox:inline-mod:mod_${inlineModuleCounter++}`;

	modRegistry.set(moduleId, inspectInlineMod(options));

	return moduleId;
}

export function defineModule(name: string, options: ModuleOptions): string {
	if (modRegistry.has(name)) {
		throw new InlineModulePluginError(`Module "${name}" already defined.`);
	}
	modRegistry.set(name, inspectInlineMod(options));

	return name;
}

export type Options = Record<never, never>;

export default function inlineModPlugin(_options: Options = {}) {
	return {
		name: '@inox-tools/inline-mod',
		resolveId(id: string) {
			if (modRegistry.has(id)) {
				return '\0' + id;
			}
			return null;
		},
		async load(id: string) {
			if (!id.startsWith('\0')) {
				return null;
			}

			const ref = id.slice(1);

			if (!modRegistry.has(ref)) {
				return null;
			}

			const serializedModule = await modRegistry.get(ref)!;

			return serializedModule.text;
		},
	};
}
