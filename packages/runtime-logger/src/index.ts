import { withApi, type IntegrationFromSetup } from '@inox-tools/modular-station';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { fileURLToPath } from 'node:url';
import { buildLoggerPlugin } from './buildLoggerPlugin.js';
import { devLoggerPlugin } from './devLoggerPlugin.js';
import { loggerInternalsPlugin } from './internalPlugin.js';

const internalIntegration = withApi(() => {
	const loggers = new Map<string, AstroIntegrationLogger>();

	return {
		name: '@inox-tools/runtime-logger/internal',
		hooks: {
			'astro:config:setup': (params) => {
				switch (params.command) {
					case 'build': {
						params.updateConfig({
							vite: {
								plugins: [loggerInternalsPlugin, buildLoggerPlugin(loggers)],
							},
						});
					}
					case 'dev': {
						params.updateConfig({
							vite: {
								plugins: [devLoggerPlugin(loggers)],
							},
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

export function runtimeLogger(
	params: IntegrationFromSetup & { logger: AstroIntegrationLogger },
	options: { name: string }
) {
	const api = internalIntegration.fromSetup(params);

	api.addLogger(options.name, params.logger);
}

export default function integration(): AstroIntegration {
	return {
		name: '@inox-tools/runtime-logger',
		hooks: {
			'astro:config:setup': async (params) => {
				runtimeLogger(params, { name: '__project' });

				params.updateConfig({
					vite: {
						plugins: [
							(await import('./projectLoggerPlugin.js')).projectLoggerPlugin(
								fileURLToPath(params.config.srcDir)
							),
						],
					},
				});
			},
		},
	};
}
