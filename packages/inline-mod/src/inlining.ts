import { getRandomValues } from 'node:crypto';
import type { Entry } from './closure/entry.js';
import { getInspector } from './closure/inspectCode.js';
import { serializeModule, type ModEntry, type SerializedModule } from './closure/serialization.js';
import { modRegistry } from './state.js';

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
	modName?: string;
};

const idBuffer = Buffer.alloc(24);

export function inlineMod(options: ModuleOptions): string {
	const moduleId =
		options.modName ?? `inox:inline-mod:${getRandomValues(idBuffer).toString('hex')}`;

	modRegistry.set(moduleId, inspectInlineMod(options));

	return moduleId;
}

async function inspectInlineMod(options: ModuleOptions): Promise<SerializedModule> {
	const inspector = getInspector(options.serializeFn);

	const maybeInspect = (val: unknown): Promise<Entry> | undefined => {
		if (val === undefined) {
			return;
		}

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

	return serializeModule(modEntry);
}
