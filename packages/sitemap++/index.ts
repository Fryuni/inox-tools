import { defineIntegration, createResolver } from 'astro-integration-kit';
import routeConfigPlugin from '@inox-tools/aik-route-config';
import { AstroError } from 'astro/errors';
import { type RouteData } from 'astro';
import { EnumChangefreq } from 'sitemap';
import { z } from 'astro/zod';
import * as path from 'node:path';
import { addVirtualImportsPlugin, hasIntegrationPlugin } from 'astro-integration-kit/plugins';
import { normalizePath } from 'vite';
import sitemap from '@astrojs/sitemap';
import { Console } from 'node:console';
import './virtual.d.ts';

process.setSourceMapsEnabled(true);

const console = new Console({
	stdout: process.stdout,
	stderr: process.stderr,
	inspectOptions: {
		depth: 5,
		colors: true,
		sorted: true,
		showProxy: true,
		showHidden: true,
	},
});

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
	plugins: [addVirtualImportsPlugin, hasIntegrationPlugin, routeConfigPlugin],
	setup: ({ options: { includeByDefault, ...options } }) => {
		const decidedOptions = new Map<string, boolean>();
		const componentImportMapping = new Map<string, string>();

		return {
			'astro:config:setup': ({
				defineRouteConfig,
				hasIntegration,
				injectRoute,
				updateConfig,
				config,
			}) => {
				if (hasIntegration('@astrojs/sitemap')) {
					throw new AstroError(
						'Cannot use both `@inox-tools/declarative-sitemap` and `@astrojs/sitemap` integrations at the same time.',
						'Remove the `@astrojs/sitemap` integration from your project to use `@inox-tools/declarative-sitemap`.'
					);
				}

				injectRoute({
					pattern: 'foo',
					entrypoint: '@inox-tools/sitemap++/foo.astro',
				});

				type ConfigCallback = (hooks: {}) => Promise<void> | void;

				defineRouteConfig({
					importName: 'sitemap++:config',
					callbackHandler: (context, configCb: ConfigCallback) => {
						configCb({});
					},
				});

				// The sitemap integration will run _after_ the build is done, so after the build re-mapping done below.
				updateConfig({
					integrations: [
						sitemap({
							...options,
							filter: (page) => {
								const url = new URL(page);
								const route = path.relative(config.base, url.pathname);

								return decidedOptions.get(trimSlashes(route)) ?? includeByDefault;
							},
						}),
					],
				});
			},
			'astro:build:done': async ({ routes, pages }) => {
				const resolution = await collectSitemapConfigurationFromRoutes(routes);

				for (const page of pages) {
					const sitePath = trimSlashes(page.pathname);
					const staticDecision = resolution.static.get(sitePath);

					if (staticDecision !== undefined) {
						decidedOptions.set(sitePath, staticDecision);
						continue;
					}

					const dynamicDecision = resolution.dynamic.find((decision) =>
						decision.pattern.test(sitePath)
					)?.decision;

					if (dynamicDecision === undefined) continue;

					decidedOptions.set(sitePath, dynamicDecision);
				}
			},
		};

		async function collectSitemapConfigurationFromRoutes(
			routes: RouteData[]
		): Promise<SiteMapResolution> {
			const result: SiteMapResolution = {
				static: new Map(),
				dynamic: [],
			};

			for (const route of routes) {
				// Only pages may enter the sitemap
				if (route.type !== 'page') continue;

				const moduleName = componentImportMapping.get(route.component);
				if (!moduleName) continue;

				console.log('Importing module:', moduleName);

				const componentValue = await import(/* @vite-ignore */ moduleName);

				// No sitemap configuration
				if (componentValue.sitemap === undefined) continue;

				switch (componentValue.sitemap) {
					case true:
					case false: {
						if (route.pathname === undefined) {
							result.dynamic.push({
								pattern: route.pattern,
								decision: componentValue.sitemap,
							});
						} else {
							result.static.set(trimSlashes(route.pathname), componentValue.sitemap);
						}
						break;
					}
				}
			}

			console.log(result);

			return result;
		}
	},
});

function getFileURL(id: string): URL | undefined {
	const filename = normalizePath(id);
	try {
		return new URL(`file://${filename}`);
	} catch (e) {
		// If we can't construct a valid URL, exit early
		return;
	}
}

type SiteMapResolution = {
	static: Map<string, boolean>;
	dynamic: Array<{
		pattern: RegExp;
		decision: boolean;
	}>;
};

function trimSlashes(input: string): string {
	return input.replace(/^\/+|\/+$/g, '');
}
