import { createResolver, defineIntegration } from 'astro-integration-kit';
import { z } from 'astro/zod';
import { debug } from './internal/debug.js';

export default defineIntegration({
	name: '@inox-tools/portal-gun',
	optionsSchema: z.never().optional(),
	setup() {
		const { resolve } = createResolver(import.meta.url);

		return {
			hooks: {
				'astro:config:setup': (params) => {
					debug('Injecting middleware');
					params.addMiddleware({
						order: 'pre',
						entrypoint: resolve('./runtime/middleware.js'),
					});
				},
			},
		};
	},
});
