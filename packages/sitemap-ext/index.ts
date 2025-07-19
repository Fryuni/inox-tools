import {
	defineIntegration,
	addIntegration,
	hasIntegration,
	withPlugins,
} from 'astro-integration-kit';
import routeConfigPlugin from '@inox-tools/aik-route-config';
import { AstroError } from 'astro/errors';
import { type AstroIntegrationLogger, type RouteData } from 'astro';
import { EnumChangefreq } from 'sitemap';
import { z } from 'astro/zod';
import * as path from 'node:path';
import sitemap from '@astrojs/sitemap';
import './virtual.d.ts';
import { inspect } from 'node:util';

process.setSourceMapsEnabled(true);

export default defineIntegration({
	name: '@inox-tools/sitemap-ext',
	optionsSchema: z
		.object({
			includeByDefault: z.boolean().default(false),
			customPages: z.array(z.string()).optional(),
			i18n: z
				.object({
					defaultLocale: z.string(),
					locales: z.record(z.string()),
				})
				.optional(),
			entryLimit: z.number().optional(),
			changefreq: z.nativeEnum(EnumChangefreq).optional(),
			lastmod: z.date().optional(),
			priority: z.number().optional(),
		})
		.default({}),
	setup: ({ name, options: { includeByDefault, customPages: _externalPages, ...options } }) => {
		type InclusionRule =
			| { type: 'regex'; regex: RegExp; decision: boolean }
			| { type: 'static'; path: string; comparePath: string; decision: boolean; static: boolean };

		const inclusions: InclusionRule[] = [];
		function makeDecision(
			decision: boolean,
			route: RouteData,
			routeParams: Record<string, string | undefined>[] = []
		) {
			if (route.pathname === undefined) {
				if (routeParams.length === 0) {
					inclusions.push({ type: 'regex', regex: route.pattern, decision });
				} else {
					for (const routeParam of routeParams) {
						const pathName = route.generate(routeParam);

						inclusions.push({
							type: 'static',
							path: pathName,
							comparePath: onlyLeadingSlash(pathName),
							decision,
							static: false,
						});
					}
				}
			} else {
				inclusions.push({
					type: 'static',
					path: route.pathname,
					comparePath: onlyLeadingSlash(route.pathname),
					decision,
					static: true,
				});
			}
		}

		const extraPages: string[] = [...(_externalPages ?? [])];

		let trailingSlash = false;
		let baseUrl!: URL;
		let basePath!: string;
		let logger!: AstroIntegrationLogger;

		const innerIntegration = sitemap({
			...options,
			// This relies on an internal detail of the sitemap integration that the reference
			// to the array is passed around without being copied.
			customPages: extraPages,
			filter: (page) => {
				const url = new URL(page);
				const route = onlyLeadingSlash(path.relative(basePath, url.pathname));

				const ruling = inclusions.find(
					(r) =>
						(r.type === 'static' && r.comparePath === route) ||
						(r.type === 'regex' && r.regex.test(route))
				);

				logger.debug(`Ruling for ${route}: ${inspect(ruling ?? includeByDefault)}`);

				return ruling?.decision ?? includeByDefault;
			},
		});

		debugger;

		return withPlugins({
			name,
			plugins: [routeConfigPlugin],
			hooks: {
				...innerIntegration.hooks,
				'astro:config:setup': async (params) => {
					const { defineRouteConfig, config } = params;
					trailingSlash = config.trailingSlash !== 'never';
					basePath = config.base ?? '';
					logger = params.logger;
					baseUrl = new URL(config.base ?? '', config.site);

					if (hasIntegration(params, { name: '@astrojs/sitemap' })) {
						throw new AstroError(
							'Cannot use both `@inox-tools/sitemap-ext` and `@astrojs/sitemap` integrations at the same time.',
							'Remove the `@astrojs/sitemap` integration from your project to use `@inox-tools/sitemap-ext`.'
						);
					}

					type ConfigCallback = (hooks: {
						addToSitemap: (routeParams?: Record<string, string | undefined>[]) => void;
						removeFromSitemap: (routeParams?: Record<string, string | undefined>[]) => void;
						setSitemap: (
							routeParams: Array<{ sitemap?: boolean; params: Record<string, string | undefined> }>
						) => void;
					}) => Promise<void> | void;

					defineRouteConfig({
						importName: 'sitemap-ext:config',
						callbackHandler: async (context, configCb: ConfigCallback | boolean) => {
							const hooks: Parameters<ConfigCallback>[0] = {
								removeFromSitemap(routeParams) {
									for (const route of context.routeData) {
										makeDecision(false, route, routeParams);
									}
								},
								addToSitemap(routeParams) {
									for (const route of context.routeData) {
										makeDecision(true, route, routeParams);
									}
								},
								setSitemap(routeOptions) {
									for (const route of context.routeData) {
										for (const { sitemap: decision, params: routeParams } of routeOptions) {
											makeDecision(decision ?? includeByDefault, route, [routeParams]);
										}
									}
								},
							};

							logger.debug('Running sitemap config callback:' + inspect({ context, configCb }));
							if (typeof configCb === 'boolean') {
								if (configCb) {
									hooks.addToSitemap();
								} else {
									hooks.removeFromSitemap();
								}
							} else {
								await configCb(hooks);
							}
						},
					});

					// Add dummy integration so other integrations can detect that sitemap is present.
					addIntegration(params, {
						integration: {
							name: innerIntegration.name,
							hooks: {},
						},
					});

					await innerIntegration.hooks['astro:config:setup']?.(params);
				},
				'astro:build:done': async (params) => {
					const extraPagesSet = new Set<string>(
						inclusions
							.filter(
								(i): i is InclusionRule & { type: 'static' } =>
									i.type === 'static' && i.decision && !i.static
							)
							.map((i) => trimSlashes(i.path))
					);

					for (const page of params.pages) {
						extraPagesSet.delete(trimSlashes(page.pathname));
					}

					for (const page of extraPagesSet) {
						const url = trimSlashes(new URL(page, baseUrl).toString());
						extraPages.push(trailingSlash ? url + '/' : url);
					}

					await innerIntegration.hooks['astro:build:done']?.(params);
				},
			},
		});
	},
});

function trimSlashes(input: string): string {
	return input.replace(/^\/+|\/+$/g, '');
}

function onlyLeadingSlash(input: string): string {
	return '/' + trimSlashes(input);
}
