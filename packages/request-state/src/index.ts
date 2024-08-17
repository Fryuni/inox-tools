import { defineIntegration, addVitePlugin } from 'astro-integration-kit';
import { plugin } from './plugin.js';

export default defineIntegration({
	name: '@inox-tools/request-state',
	setup() {
		return {
			hooks: {
				'astro:config:setup': (params) => {
					const { addMiddleware } = params;

					addMiddleware({
						order: 'pre',
						entrypoint: '@inox-tools/request-state/runtime/middleware',
					});
					addVitePlugin(params, {
						warnDuplicated: true,
						plugin: plugin(),
					});
				},
			},
		};
	},
});
