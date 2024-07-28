import { defineIntegration, addVitePlugin } from 'astro-integration-kit';
import { z } from 'astro/zod';
import { makePlugin } from './plugin.js';

export default defineIntegration({
	name: '@inox-tools/star-warp',
	optionsSchema: z.never().optional(),
	setup() {
		const config = {
			env: 'dev',
			trailingSlash: 'ignore',
		};

		return {
			hooks: {
				'astro:config:setup': (params) => {
					config.env = params.command === 'dev' ? 'dev' : 'prod';
					config.trailingSlash = params.config.trailingSlash;

					addVitePlugin(params, {
						plugin: makePlugin(config),
						warnDuplicated: true,
					});

					params.injectRoute({
						pattern: 'warp',
						entrypoint: '@inox-tools/star-warp/components/warp.astro',
						prerender: true,
					});
				},
				'astro:config:done': (params) => {
					config.trailingSlash = params.config.trailingSlash;
				},
			},
		};
	},
});
