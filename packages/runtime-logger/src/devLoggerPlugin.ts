import type { Plugin } from 'vite';
import type { AstroIntegrationLogger } from 'astro';

const MODULE_PREFIX = '@it-astro:logger:';
const RESOLVED_MODULE_PREFIX = '\x00@it-astro:logger:';

const pluginName = '@inox-tools/runtime-logger/dev';

export const devLoggerPlugin = (loggers: Map<string, AstroIntegrationLogger>): Plugin => {
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
			if (!loggers.has(loggerName)) return;

			return `
console.log(Symbol.for('${pluginName}'));

const logger = globalThis[Symbol.for('${pluginName}')].get('${loggerName}');

export { logger };
`;
		},
	};
};
