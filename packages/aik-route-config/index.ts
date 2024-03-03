import { definePlugin } from 'astro-integration-kit';
import { addVitePlugin } from 'astro-integration-kit/utilities';
import { hoistGlobalPlugin } from './hoistGlobalPlugin.js';

type PerRouteConfigOptions = {
	importName: string;
};

export default definePlugin({
	name: 'defineRouteConfig',
	hook: 'astro:config:setup',
	implementation: (astroConfig, integrationConfig) => {
		const { logger, injectScript, updateConfig } = astroConfig;

		return (options: PerRouteConfigOptions): void => {
			addVitePlugin({
				plugin: hoistGlobalPlugin({
					configImport: options.importName,
				}),
				updateConfig,
			});
		};
	},
});
