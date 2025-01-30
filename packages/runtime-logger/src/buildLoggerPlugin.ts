import type { Plugin } from 'vite';
import type { AstroIntegrationLogger } from 'astro';
import { INTERNAL_MODULE } from './internalPlugin.js';

const MODULE_PREFIX = '@it-astro:logger:';
const RESOLVED_MODULE_PREFIX = '\x00@it-astro:logger:';

const pluginName = '@inox-tools/runtime-logger/integrations';

export const buildLoggerPlugin = (loggers: Map<string, AstroIntegrationLogger>): Plugin => {
	(globalThis as any)[Symbol.for(pluginName)] = loggers;

	return {
		name: pluginName,
		resolveId(id) {
			if (id.startsWith(MODULE_PREFIX)) {
				const loggerName = id.slice(MODULE_PREFIX.length);
				if (loggers.has(loggerName)) {
					return `${RESOLVED_MODULE_PREFIX}${loggerName}`;
				}
			}
			return null;
		},
		load(id) {
			if (!id.startsWith(RESOLVED_MODULE_PREFIX)) return;
			const loggerName = id.slice(RESOLVED_MODULE_PREFIX.length);
			const logger = loggers.get(loggerName)!;
			if (logger === undefined) return;

			return `
import { baseLogger } from ${JSON.stringify(INTERNAL_MODULE)};

const buildLogger = globalThis[Symbol.for(${JSON.stringify(pluginName)})]?.get(${JSON.stringify(loggerName)});

const logger = buildLogger ?? baseLogger.fork(${JSON.stringify(logger.label)});

if (buildLogger === undefined) {
	logger.options.level = ${JSON.stringify(logger.options.level)};
}

export { logger };
`;
		},
	};
};
