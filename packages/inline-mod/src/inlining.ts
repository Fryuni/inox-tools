import type { Entry } from './closure/entry.js';
import { getInspector } from './closure/inspectCode.js';
import { Lazy } from '@inox-tools/utils/lazy';
import { serializeModule, type ModEntry, type SerializedModule } from './closure/serialization.js';
import { getLogger } from './log.js';

const log = getLogger('inlining');

export type ModuleOptions = {
	constExports?: Record<string, unknown>;
	defaultExport?: unknown;
	assignExports?: Record<string, unknown>;
	serializeFn?: (val: unknown) => boolean;
};

export interface InlineModule extends SerializedModule {
	module: Lazy<Promise<unknown>>;
}

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
		assignExports: options.assignExports
			? Object.fromEntries(
				await Promise.all(
					Object.entries(options.assignExports).map(
						async ([key, value]) => [key, await inspector.inspect(value)] as const
					)
				)
			)
			: undefined,
	};

	const { text } = await serializeModule(modEntry);

	return {
		text: text,
		module: Lazy.of(() => {
			const content = 'data:text/javascript,' + text;

			return import(/* @vite-ignore */ content);
		}),
	};
}
