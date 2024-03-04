import { defineIntegration } from 'astro-integration-kit';
import routeConfigPlugin from '@inox-tools/aik-route-config';
import { AstroError } from 'astro/errors';
import { type RouteData } from 'astro';
import { EnumChangefreq } from 'sitemap';
import { z } from 'astro/zod';
import * as path from 'node:path';
import {
	addVirtualImportsPlugin,
	addIntegrationPlugin,
	hasIntegrationPlugin,
} from 'astro-integration-kit/plugins';
import sitemap from '@astrojs/sitemap';
import './virtual.d.ts';

process.setSourceMapsEnabled(true);

export default defineIntegration({
	name: '@inox-tools/declarative-sitemap',
	optionsSchema: z.object({
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
	}),
	plugins: [addVirtualImportsPlugin, addIntegrationPlugin, hasIntegrationPlugin, routeConfigPlugin],
	setup: ({ options: { includeByDefault, ...options } }) => {
		type InclusionRule =
			| { type: 'regex'; regex: RegExp; decision: boolean }
			| { type: 'static'; path: string; decision: boolean };

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
						// TODO: https://github.com/withastro/astro/pull/10298
						const pathName = route.generate(routeParam) || '/';

						inclusions.push({ type: 'static', path: pathName, decision });
					}
				}
			} else {
				inclusions.push({ type: 'static', path: route.pathname, decision });
			}
		}

		const extraPages: string[] = [];

		let baseUrl!: URL;

		return {
			'astro:config:setup': ({ defineRouteConfig, hasIntegration, addIntegration, config }) => {
				if (hasIntegration('@astrojs/sitemap')) {
					throw new AstroError(
						'Cannot use both `@inox-tools/declarative-sitemap` and `@astrojs/sitemap` integrations at the same time.',
						'Remove the `@astrojs/sitemap` integration from your project to use `@inox-tools/declarative-sitemap`.'
					);
				}

				baseUrl = new URL(config.base ?? '', config.site);

				type ConfigCallback = (hooks: {
					addToSitemap: (routeParams?: Record<string, string | undefined>[]) => void;
					removeFromSitemap: (routeParams?: Record<string, string | undefined>[]) => void;
					setSitemap: (
						routeParams: Array<{ sitemap?: boolean; params: Record<string, string | undefined> }>
					) => void;
				}) => Promise<void> | void;

				defineRouteConfig({
					importName: 'sitemap-ext:config',
					callbackHandler: (context, configCb: ConfigCallback) => {
						configCb({
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
									for (const { sitemap: decision, params } of routeOptions) {
										makeDecision(decision ?? includeByDefault, route, [params]);
									}
								}
							},
						});
					},
				});

				// The sitemap integration will run _after_ the build is done, so after the build re-mapping done below.
				addIntegration(
					sitemap({
						...options,
						// This relies on an internal detail of the sitemap integration that the reference
						// to the array is passed around without being copied.
						customPages: extraPages,
						filter: (page) => {
							const url = new URL(page);
							const route = path.relative(config.base, url.pathname);

							const ruling = inclusions.find(
								(r) =>
									(r.type === 'static' && r.path === route) ||
									(r.type === 'regex' && r.regex.test(route))
							);

							return ruling?.decision ?? includeByDefault;
						},
					})
				);
			},
			'astro:build:done': async ({ pages }) => {
				const extraPagesSet = new Set<string>(
					inclusions
						.filter(
							(i): i is InclusionRule & { type: 'static' } => i.type === 'static' && i.decision
						)
						.map((i) => trimSlashes(i.path))
				);

				for (const page of pages) {
					extraPagesSet.delete(trimSlashes(page.pathname));
				}

				for (const page of extraPagesSet) {
					extraPages.push(new URL(page, baseUrl).toString());
				}
			},
		};
	},
});

function trimSlashes(input: string): string {
	return input.replace(/^\/+|\/+$/g, '');
}
