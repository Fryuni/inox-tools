import { defineMiddlewarePlugin, defineModPlugin, inlineModPlugin } from '@inox-tools/aik-mod';
import type { APIRoute, MiddlewareHandler } from 'astro';
import { z } from 'astro/zod';
import { defineIntegration } from 'astro-integration-kit';
import { defineMiddleware as defineMiddlewareHandler } from 'astro/middleware';
export { asyncFactory, factory } from '@inox-tools/aik-mod';

export default defineIntegration({
	name: 'custom-integration',
	optionsSchema: z.object({
		config: z.any().optional(),
		locals: z.record(z.any()).optional(),
		inlineMiddleware: z.custom<MiddlewareHandler>((val) => val instanceof Function).optional(),
		inlineRoute: z.custom<APIRoute>((val) => val instanceof Function).optional(),
	}),
	plugins: [defineModPlugin, inlineModPlugin, defineMiddlewarePlugin],
	setup: ({ options }) => {
		// Cast due to https://github.com/florian-lefebvre/astro-integration-kit/pull/48
		const { config, locals, inlineMiddleware, inlineRoute } = options;

		return {
			'astro:config:setup': ({
				defineModule,
				inlineModule,
				defineMiddleware,
				addWatchFile,
				addMiddleware,
				injectRoute,
			}) => {
				addWatchFile(import.meta.url);

				defineModule('virtual:configuration', {
					defaultExport: config,
				});

				// Define an inline middleware manually
				addMiddleware({
					order: 'pre',
					entrypoint: inlineModule({
						constExports: {
							onRequest: defineMiddlewareHandler((context, next) => {
								context.locals = { ...locals };
								return next();
							}),
						},
					}),
				});

				if (inlineMiddleware) {
					// Or using the specialized plugin!
					defineMiddleware('pre', inlineMiddleware);
				}

				if (inlineRoute) {
					defineModule('virtual:injectedRoute', {
						constExports: {
							GET: inlineRoute,
						},
					});

					injectRoute({
						pattern: '/inline-route',
						// Entrypoint for routes must be resolvable to a file on disk,
						// virtual modules cannot be used.
						// But a file that re-exports a virtual module can!
						entrypoint: './routeInjection.ts',
					});
				}
			},
		};
	},
});
