import type { AstroIntegration, AstroIntegrationLogger, HookParameters, RouteData } from 'astro';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
let ssrComponents: string[] = [];
let ssrImportPromise: Promise<void> | undefined;

export async function loadRouteConfigCallbacks(logger: AstroIntegrationLogger): Promise<void> {
	if (ssrComponents.length === 0) return;

	ssrImportPromise ??= (async () => {
		for (const modulePath of ssrComponents) {
			await import(/* @vite-ignore */ pathToFileURL(modulePath).href).catch((error) => {
				logger.error(`Failed to import SSR component: ${modulePath} ${inspect(error)}`);
			});
		}
	})();

	await ssrImportPromise;
}

function integration(): AstroIntegration {
	let root!: URL;

	return {
		name: '@inox-tools/route-config/context-resolution',
		hooks: {
			'astro:config:setup': (params) => {
				root = params.config.root;

				params.updateConfig({
					vite: {
						plugins: [
							{
								name: '@inox-tools/route-config/context-resolution',
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
						],
					},
				});
			},
			'astro:build:setup': ({ pages, target }) => {
				ssrComponents = [];
				ssrImportPromise = undefined;

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
			'astro:build:ssr': async ({ manifest: { routes } }) => {
				ssrComponents = routes
					.map((r) => r.routeData)
					.filter((r) => r.type === 'page')
					.map((r) => r.component)
					.map((c) => normalizePath(fileURLToPath(new URL(c, root))))
					.map((c) => componentToChunkMapping.get(c))
					.filter((m): m is string => m !== undefined);
			},
			'astro:build:generated': async ({ logger }) => {
				await loadRouteConfigCallbacks(logger);
			},
			'astro:build:done': async ({ logger }) => {
				await loadRouteConfigCallbacks(logger);
			},
		},
	};
}

const integratedConfigs = new WeakSet<HookParameters<'astro:config:setup'>['updateConfig']>();

export function integrate({
	updateConfig,
}: Pick<HookParameters<'astro:config:setup'>, 'updateConfig'>) {
	if (integratedConfigs.has(updateConfig)) return;
	integratedConfigs.add(updateConfig);

	debug('Injecting route-config integration');
	updateConfig({
		integrations: [integration()],
	});
}
