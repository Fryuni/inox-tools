import { withApi } from '@inox-tools/modular-station';
import {
	addVitePlugin,
	defineIntegration,
	defineUtility,
	type HookParameters,
} from 'astro-integration-kit';
import { z } from 'astro/zod';
import { buildLoggerPlugin } from './buildLoggerPlugin.js';
import { loggerInternalsPlugin } from './internalPlugin.js';
import { devLoggerPlugin } from './devLoggerPlugin.js';
import type { AstroIntegrationLogger } from 'astro';
import { fileURLToPath } from 'url';

const schema = z
	.object({
		name: z.string(),
	})
	.strict();

const internalIntegration = withApi(() => {
	const loggers = new Map<string, AstroIntegrationLogger>();

	return {
		name: '@inox-tools/runtime-logger/internal',
		hooks: {
			'astro:config:setup': (params) => {
				switch (params.command) {
					case 'build': {
						addVitePlugin(params, {
							plugin: loggerInternalsPlugin,
							warnDuplicated: true,
						});
						addVitePlugin(params, {
							plugin: buildLoggerPlugin(loggers),
							warnDuplicated: true,
						});
					}
					case 'dev': {
						addVitePlugin(params, {
							plugin: devLoggerPlugin(loggers),
							warnDuplicated: true,
						});
					}
				}
			},
		},
		addLogger(name: string, logger: AstroIntegrationLogger) {
			loggers.set(name, logger);
		},
	};
});

export const runtimeLogger = defineUtility('astro:config:setup')((
	params: HookParameters<'astro:config:setup'>,
	options: z.infer<typeof schema>
) => {
	const api = internalIntegration.fromSetup(params);

	api.addLogger(options.name, params.logger);
});

export default defineIntegration({
	name: '@inox-tools/runtime-logger',
	setup: () => ({
		hooks: {
			'astro:config:setup': async (params) => {
				runtimeLogger(params, { name: '__project' });

				addVitePlugin(params, {
					plugin: (await import('./projectLoggerPlugin.js')).projectLoggerPlugin(
						fileURLToPath(params.config.srcDir)
					),
					warnDuplicated: true,
				});
			},
		},
	}),
});
