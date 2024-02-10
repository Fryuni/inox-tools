import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { magicFactory } from './closure/inspectCode.js';
import { InlineModuleError } from './closure/types.js';
import { inspectInlineMod, type InlineModule, type ModuleOptions } from './inlining.js';

export type { ModuleOptions };

const rootPath = path.join(process.cwd(), '.inox-tools', 'inline-mod');

const modRegistry = new Map<string, Promise<InlineModule>>();

function register(name: string, modInfoPromise: Promise<InlineModule>): void {
	if (process.env.NODE_ENV === 'production' && modRegistry.has(name)) {
		throw new InlineModulePluginError(`Module "${name}" already defined.`);
	}

	if (process.env.EMIT_INLINE_MODULES) {
		modInfoPromise.then(async (modInfo) => {
			await fs.mkdir(rootPath, { recursive: true });

			await fs.writeFile(path.join(rootPath, name.replace(/:/g, '_') + '.mjs'), modInfo.text, {
				encoding: 'utf-8',
			});
		});
	}

	modRegistry.set(name, modInfoPromise);
}

class InlineModulePluginError extends InlineModuleError { }

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

	register(moduleId, inspectInlineMod(options));

	return moduleId;
}

export function defineModule(name: string, options: ModuleOptions): string {
	register(name, inspectInlineMod(options));

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
