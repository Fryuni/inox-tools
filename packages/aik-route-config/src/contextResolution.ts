import type { HookParameters, RouteData } from 'astro';
import * as path from 'node:path';
import { Once } from '@inox-tools/utils/once';
import { defineIntegration, addIntegration, addVitePlugin } from 'astro-integration-kit';
import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';
import { inspect } from 'node:util';
import { debug } from './debug.js';

export type ConfigContext = {
	route: string[];
	routeData: RouteData[];
	component: string;
};

export type InnerContext = {
	bundleFile: string;
	sourceFile: string;
};

export function convertContext(context: InnerContext): ConfigContext | null {
	return componentToContextMapping.get(context.sourceFile) ?? null;
}

const componentToChunkMapping = new Map<string, string>();
const componentToContextMapping = new Map<string, ConfigContext>();

const integration = defineIntegration({
	name: '@inox-tools/aik-route-config/context-resolution',
	setup: () => {
		let root!: URL;

		return {
			hooks: {
				'astro:config:setup': (params) => {
					const { config } = params;
					root = config.root;

					addVitePlugin(params, {
						plugin: {
							name: '@inox-tools/aik-route-config/context-resolution',
							async writeBundle(outputOptions, bundle) {
								const basePath = outputOptions.dir!;

								for (const chunk of Object.values(bundle)) {
									if (chunk.type !== 'chunk') continue;

									const fileName = path.join(basePath, chunk.fileName);

									for (const id of chunk.moduleIds) {
										if (id.endsWith('.astro')) {
											componentToChunkMapping.set(id, fileName);
										}
									}
								}
							},
						},
					});
				},
				'astro:build:setup': ({ pages, target }) => {
					if (target !== 'server') return;

					for (const { route } of pages.values()) {
						const fullComponentPath = normalizePath(fileURLToPath(new URL(route.component, root)));
						const context = componentToContextMapping.get(fullComponentPath);

						if (context) {
							context.route.push(route.route);
							context.routeData.push(route);
						} else {
							componentToContextMapping.set(fullComponentPath, {
								route: [route.route],
								routeData: [route],
								component: route.component,
							});
						}
					}
				},
				'astro:build:ssr': async ({ logger, manifest: { routes } }) => {
					const ssrComponents = routes
						.map((r) => r.routeData)
						.filter((r) => r.type === 'page')
						.map((r) => r.component)
						.map((c) => fileURLToPath(new URL(c, root)))
						.map((c) => componentToChunkMapping.get(c))
						.filter((m) => !!m);

					// Import SSR components so the hoisted logic gets executed
					for (const module of ssrComponents) {
						await import(/* @vite-ignore */ module!).catch((error) => {
							logger.error(`Failed to import SSR component: ${module!} ${inspect(error)}`);
						});
					}
				},
			},
		};
	},
});

const integrateOnce = new Once();

type IntegrateParams = HookParameters<'astro:config:setup'>;

export function integrate(params: IntegrateParams) {
	integrateOnce.do(() => {
		debug('Injecting route-config integration');
		addIntegration(params, {
			integration: integration(),
			ensureUnique: true,
		});
	});
}
