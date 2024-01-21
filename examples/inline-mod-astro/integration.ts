import inlineModPlugin, { inlineMod } from '@inox-tools/inline-mod/vite';
import type { AstroIntegration, APIRoute } from 'astro';
import { defineMiddleware } from 'astro/middleware';

type Options = {
	config: any;
	locals: Record<string, any>;
	inlineRoute?: APIRoute;
};

export default function customIntegration({
	config,
	locals,
	inlineRoute,
}: Options): AstroIntegration {
	return {
		name: 'custom-integration',
		hooks: {
			'astro:config:setup': ({ updateConfig, injectRoute, addMiddleware }) => {
				inlineMod({
					defaultExport: config,
					modName: 'virtual:configuration',
				});

				addMiddleware({
					order: 'pre',
					entrypoint: inlineMod({
						constExports: {
							onRequest: defineMiddleware((context, next) => {
								context.locals = { ...locals };
								return next();
							}),
						},
					}),
				});

				if (inlineRoute) {
					inlineMod({
						modName: 'virtual:injectedRoute',
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
