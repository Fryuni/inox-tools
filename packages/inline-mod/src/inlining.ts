import { getRandomValues } from 'node:crypto';
import type { Entry } from './closure/entry.js';
import { getInspector } from './closure/inspectCode.js';
import { Lazy } from './closure/lazy.js';
import { serializeModule, type ModEntry, type SerializedModule } from './closure/serialization.js';
import { getLogger } from './log.js';
import { modRegistry } from './state.js';

const log = getLogger('inlining');

type ModuleExports =
	| {
			constExports?: Record<string, unknown>;
			defaultExport?: unknown;
			assignExport?: never;
	  }
	| {
			constExports?: never;
			defaultExport?: never;
			assignExport: unknown;
	  };

type ModuleOptions = ModuleExports & {
	serializeFn?: (val: unknown) => boolean;
};

const idBuffer = Buffer.alloc(24);

export function inlineModule(options: ModuleOptions): string {
	const moduleId = `inox:inline-mod:${getRandomValues(idBuffer).toString('hex')}`;

	modRegistry.set(moduleId, inspectInlineMod(options));

	return moduleId;
}

export function defineModule(name: string, options: ModuleOptions) {
	modRegistry.set(name, inspectInlineMod(options));
}

interface InlineModule extends SerializedModule {
	module: Lazy<Promise<unknown>>;
}

/* @internal */
export async function inspectInlineMod(options: ModuleOptions): Promise<InlineModule> {
	log('Retrieving inspector');
	const inspector = getInspector(options.serializeFn);

	log('Inspector retrieved');

	const maybeInspect = (val: unknown): Promise<Entry> | undefined => {
		if (val === undefined) {
			return;
		}

		log('Inspecting value');
		return inspector.inspect(val);
	};

	const modEntry: ModEntry = {
		constExports: Object.fromEntries(
			await Promise.all(
				Object.entries(options.constExports ?? {}).map(
					async ([key, value]) => [key, await inspector.inspect(value)] as const
				)
			)
		),
		defaultExport: await maybeInspect(options.defaultExport),
		assignExport: await maybeInspect(options.assignExport),
	};

	const { text } = await serializeModule(modEntry);

	return {
		text: text,
		module: Lazy.of(() => {
			const content = 'data:text/javascript,' + text;

			return import(content);
		}),
	};
}
