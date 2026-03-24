import { makePlugin } from './configPlugin.js';
import type { AstroIntegration } from 'astro';
import { makeOpenSearchPlugin } from './openSearchPlugin.js';
import type { StarlightPlugin } from '@astrojs/starlight/types';

interface Options {
	path?: string;
	openSearch?: {
		enabled?: boolean;
		title?: string;
		description?: string;
	};
}

const NAME = '@inox-tools/star-warp';

export default function starWarp({ path = 'warp', openSearch = {} }: Options = {}) {
	const options = { path, openSearch };

	const config = {
		env: 'dev',
		trailingSlash: 'ignore',
	};

	const pathPattern = options.path.replace(/(^\/+|\/+$)/g, '');

	// Yeah it is like this for the type generation to result in friendly types.
	// Deal with it future me!
	const comboIntegration: AstroIntegration & StarlightPlugin = {
		name: NAME,
		hooks: {
			setup: (params: any) => {
				const { addIntegration, astroConfig, updateConfig, config } = params;

				if (astroConfig.integrations.some((i: AstroIntegration) => i.name === NAME)) return;

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

				params.updateConfig({
					vite: {
						plugins: [makePlugin(config)],
					},
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

					params.updateConfig({
						vite: {
							plugins: [
								makeOpenSearchPlugin({
									siteName,
									description: options.openSearch.description ?? `Search ${siteName}`,
									searchURL: url.toString(),
								}),
							],
						},
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
}
