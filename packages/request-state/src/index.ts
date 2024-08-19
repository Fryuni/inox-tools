import { defineIntegration, addVitePlugin, createResolver } from 'astro-integration-kit';
import { plugin } from './plugin.js';

export default defineIntegration({
	name: '@inox-tools/request-state',
	setup() {
		const { resolve } = createResolver(import.meta.url);

		return {
			hooks: {
				'astro:config:setup': (params) => {
					const { addMiddleware } = params;

					params.logger.debug('Adding request-state middleware');
					addMiddleware({
						order: 'pre',
						entrypoint: resolve('runtime/middleware.js'),
					});

					params.logger.debug('Adding request-state virtual module');
					addVitePlugin(params, {
						warnDuplicated: true,
						plugin: plugin(),
					});
				},
			},
		};
	},
});
