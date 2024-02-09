import inlineModPlugin, { defineModule, inlineModule } from '@inox-tools/inline-mod/vite';
import type { APIRoute, AstroIntegration, MiddlewareHandler } from 'astro';
import { defineMiddleware } from 'astro/middleware';

type Options = {
	config: any;
	locals: Record<string, any>;
	inlineMiddleware?: MiddlewareHandler;
	inlineRoute?: APIRoute;
};

export default function customIntegration({
	config,
	locals,
	inlineMiddleware,
	inlineRoute,
}: Options): AstroIntegration {
	return {
		name: 'custom-integration',
		hooks: {
			'astro:config:setup': ({ updateConfig, injectRoute, addMiddleware, addWatchFile }) => {
				addWatchFile(import.meta.url);

				defineModule('virtual:configuration', {
					defaultExport: config,
				});

				addMiddleware({
					order: 'pre',
					entrypoint: inlineModule({
						constExports: {
							onRequest: defineMiddleware((context, next) => {
								context.locals = { ...locals };
								return next();
							}),
						},
					}),
				});

				if (inlineMiddleware) {
					addMiddleware({
						order: 'pre',
						entrypoint: inlineModule({
							constExports: {
								onRequest: inlineMiddleware,
							},
						}),
					});
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

				updateConfig({
					vite: {
						plugins: [inlineModPlugin({})],
					},
				});
			},
		},
	};
}
