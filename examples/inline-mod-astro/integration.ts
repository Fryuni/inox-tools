import inlineModPlugin, { inlineMod } from '@inox-tools/inline-mod/vite';
import type { AstroIntegration, MiddlewareHandler } from 'astro';
import { defineMiddleware } from 'astro/middleware';

type Options = {
	config: any;
	locals: Record<string, any>;
	arbitraryMiddleware?: MiddlewareHandler;
};

export default function customIntegration({
	config,
	locals,
	arbitraryMiddleware,
}: Options): AstroIntegration {
	return {
		name: 'custom-integration',
		hooks: {
			'astro:config:setup': ({ updateConfig, addMiddleware }) => {
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

				if (arbitraryMiddleware) {
					addMiddleware({
						order: 'pre',
						entrypoint: inlineMod({
							constExports: {
								onRequest: arbitraryMiddleware,
							},
						}),
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
