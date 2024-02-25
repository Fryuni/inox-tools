import { defineIntegration } from 'astro-integration-kit';
import { AstroError } from 'astro/errors';
import { EnumChangefreq } from 'sitemap';
import { z } from 'astro/zod';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addVitePluginPlugin, hasIntegrationPlugin } from 'astro-integration-kit/plugins';
import { normalizePath } from 'vite';
import sitemap from '@astrojs/sitemap';

const POSSIBLE_PAGE_EXTENSIONS = ['.astro', '.ts', '.js', '.md', '.mdx'];

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
	plugins: [addVitePluginPlugin, hasIntegrationPlugin],
	setup: ({ options: { includeByDefault, ...options } }) => {
		const decidedOptions = new Map<
			string,
			{
				importId: string;
				decision: boolean;
			}
		>();

		return {
			'astro:config:setup': ({ addVitePlugin, hasIntegration, updateConfig, config }) => {
				if (hasIntegration('@astrojs/sitemap')) {
					throw new AstroError(
						'Cannot use both `@inox-tools/declarative-sitemap` and `@astrojs/sitemap` integrations at the same time.',
						'Remove the `@astrojs/sitemap` integration from your project to use `@inox-tools/declarative-sitemap`.'
					);
				}

				const rootPath = fileURLToPath(config.root);

				addVitePlugin({
					name: '@inox-tools/declarative-sitemap',
					enforce: 'post',
					transform(code, id, transformOptions) {
						if (!transformOptions?.ssr) return;

						const fileURL = getFileURL(id);
						if (!fileURL) return;

						if (
							fileURL.search !== '' ||
							!POSSIBLE_PAGE_EXTENSIONS.includes(path.extname(fileURL.pathname))
						)
							return;

						const [, sitemapOption] = /^export const sitemap = (true|false);?$/m.exec(code) ?? [];

						if (sitemapOption !== undefined) {
							const relativePath = path.relative(rootPath, fileURL.pathname);
							decidedOptions.set(relativePath, {
								importId: id,
								decision: sitemapOption === 'true',
							});
						}
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

								return decidedOptions.get(route)?.decision ?? includeByDefault;
							},
						}),
					],
				});
			},
			'astro:build:done': ({ routes, pages }) => {
				for (const page of pages) {
					const sitePathCandidate = '/' + page.pathname;
					const route = routes.find((r) => r.pattern.test(sitePathCandidate));
					if (!route) continue;

					const decision = decidedOptions.get(route.component);

					if (!decision) continue;

					decidedOptions.set(page.pathname.replace(/\/$/, ''), decision);
				}
			},
		};
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
