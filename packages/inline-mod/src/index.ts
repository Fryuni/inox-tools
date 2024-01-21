import { pseudoRandomBytes } from 'node:crypto';
import { serializeFunction } from './closure/serialization.js';
import { modRegistry, type ModEntry } from './state.js';
import { getInspector } from './closure/inspectCode.js';
import type { Entry } from './closure/entry.js';

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

export default function inlineMod(options: ModuleOptions): string {
	const moduleId = `inox:inline-mod:${pseudoRandomBytes(24).toString('hex')}`;

	modRegistry.set(moduleId, inspectInlineMod(options));

	return moduleId;
}

async function inspectInlineMod(options: ModuleOptions): Promise<ModEntry> {
	const inspector = getInspector(options.serializeFn);

	const maybeInspect = (val: unknown): Promise<Entry> | undefined => {
		if (val === undefined) {
			return;
		}

		return inspector.inspect(val);
	};

	return {
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
}
