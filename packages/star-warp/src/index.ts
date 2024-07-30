import { defineIntegration, addVitePlugin } from 'astro-integration-kit';
import { z } from 'astro/zod';
import { makePlugin } from './configPlugin.js';
import type { AstroIntegration } from 'astro';
import { makeOpenSearchPlugin } from './openSearchPlugin.js';

export default defineIntegration({
	name: '@inox-tools/star-warp',
	optionsSchema: z
		.object({
			path: z.string().default('warp'),
			openSearch: z
				.object({
					enabled: z.boolean().optional(),
					title: z.string().optional(),
					description: z.string().optional(),
				})
				.default({}),
		})
		.default({}),
	setup({ name, options }) {
		const config = {
			env: 'dev',
			trailingSlash: 'ignore',
		};

		const pathPattern = options.path.replace(/(^\/+|\/+$)/g, '');

		const comboIntegration = {
			name,
			hooks: {
				setup: (params: any) => {
					const { addIntegration, astroConfig, updateConfig, config } = params;

					if (astroConfig.integrations.some((i: AstroIntegration) => i.name === name)) return;

					options.openSearch.enabled ??= true;
					options.openSearch.title ??= config.title;
					options.openSearch.description ??= `Search ${config.title}`;
					addIntegration(comboIntegration);

					if (options.openSearch.enabled) {
						updateConfig({
							head: [
								...(config.head ?? []),
								{
									tag: 'link',
									attrs: {
										rel: 'search',
										type: 'application/opensearchdescription+xml',
										title: `Search ${config.title}`,
										href: `/${pathPattern}.xml`,
									},
								},
							],
						});
					}
				},
				'astro:config:setup': (params) => {
					config.env = params.command === 'dev' ? 'dev' : 'prod';
					config.trailingSlash = params.config.trailingSlash;

					addVitePlugin(params, {
						plugin: makePlugin(config),
						warnDuplicated: true,
					});

					params.injectRoute({
						pattern: pathPattern,
						entrypoint: '@inox-tools/star-warp/routes/client.astro',
						prerender: true,
					});

					if (options.openSearch.enabled) {
						const baseUrl = new URL(params.config.base, params.config.site);
						const url = new URL(pathPattern, baseUrl);

						const siteName = options.openSearch.title ?? params.config.site ?? 'Astro Site';

						addVitePlugin(params, {
							plugin: makeOpenSearchPlugin({
								siteName,
								description: options.openSearch.description ?? `Search ${siteName}`,
								searchURL: url.toString(),
							}),
							warnDuplicated: true,
						});

						params.injectRoute({
							pattern: `${pathPattern}.xml`,
							entrypoint: '@inox-tools/star-warp/routes/openSearch.ts',
							prerender: true,
						});
					}
				},
				'astro:config:done': (params) => {
					config.trailingSlash = params.config.trailingSlash;
				},
			},
		} satisfies AstroIntegration;

		return comboIntegration;
	},
});
