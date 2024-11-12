import { relative } from 'path';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE = '@it-astro:logger';
const RESOLVED_VIRTUAL_MODULE = '\x00@it-astro:logger?';

export const projectLoggerPlugin = (rootPath: string): Plugin => ({
	name: '@inox-tools/runtime-logger/project',
	resolveId(id, importer) {
		if (id === VIRTUAL_MODULE) {
			const params = new URLSearchParams();
			if (importer !== undefined) {
				const loggerName = relative(rootPath, importer);

				params.set('logger', loggerName);
			}

			return RESOLVED_VIRTUAL_MODULE + params.toString();
		}
	},
	load(id) {
		if (!id.startsWith(RESOLVED_VIRTUAL_MODULE)) return;
		const params = new URLSearchParams(id.slice(RESOLVED_VIRTUAL_MODULE.length));
		const loggerName = params.get('logger') ?? 'default';

		return `
import { logger as baseLogger } from '@it-astro:logger:__project';

export const logger = baseLogger.fork(${JSON.stringify(loggerName)});
`;
	},
});
