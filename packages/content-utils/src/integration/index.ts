import { withApi, onHook, registerGlobalHooks } from '@inox-tools/modular-station';
import { emptyState } from './state.js';
import { resolveContentPaths } from '../internal/resolver.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { addVitePlugin, defineIntegration } from 'astro-integration-kit';
import { injectorPlugin } from './injectorPlugin.js';
import { seedCollections, type SeedCollectionsOptions } from './seedCollections.js';
import { gitBuildPlugin, gitDevPlugin } from './gitPlugin.js';
import { debug } from '../internal/debug.js';

export type InjectCollectionOptions = {
	/**
	 * Module to be imported with the configured collections.
	 *
	 * This module should be resolvable from the root of the Astro project and must export a `collections` object.
	 */
	entrypoint: string;

	/**
	 * Seed collections using this template if they are not present.
	 *
	 * @see {seedCollections}
	 */
	seedTemplateDirectory?: string;
};

export const integration = withApi(
	defineIntegration({
		name: '@inox-tools/content-utils',
		setup: () => {
			debug('Generating empty state');
			const state = emptyState();
			const collectionSeedBuffer: SeedCollectionsOptions[] = [];

			const api = {
				/**
				 * Inject a content collection definition alongside the project.
				 *
				 * Collections defined here can be overriden by the project.
				 */
				injectCollection: onHook(
					['astro:config:setup', 'astro:config:done', 'astro:build:start', 'astro:server:setup'],
					(options: InjectCollectionOptions) => {
						debug('Injecting collection:', options);
						state.injectedCollectionsEntrypoints.push(options.entrypoint);

						if (options.seedTemplateDirectory) {
							api.seedCollections({
								templateDirectory: options.seedTemplateDirectory,
							});
						}
					}
				),
				seedCollections: onHook(
					['astro:config:setup', 'astro:config:done', 'astro:build:start', 'astro:server:setup'],
					(options: SeedCollectionsOptions) => {
						debug('Requesting collection seeding:', options);
						if (state.contentPaths === undefined) {
							collectionSeedBuffer.push(options);
						} else {
							seedCollections(state, options);
						}
					}
				),
			};

			return {
				hooks: {
					'astro:config:setup': (params) => {
						state.logger = params.logger;
						registerGlobalHooks(params);

						state.contentPaths = resolveContentPaths(params.config);
						debug('Resolved content paths:', state.contentPaths);

						if (!state.contentPaths.configExists) {
							// Create the `<srcDir>/content/config.ts` file if it doesn't exist,
							// otherwise there is no module to modify in the Vite lifecycle.

							debug('Creating minimal content config file:', state.contentPaths.configPath);
							mkdirSync(state.contentPaths.contentPath, { recursive: true });
							writeFileSync(state.contentPaths.configPath, 'export const collections = {};');
						}

						debug('Adding content collection injector Vite plugin');
						addVitePlugin(params, {
							plugin: injectorPlugin(state),
							warnDuplicated: true,
						});

						debug('Adding Git time Vite plugin');
						addVitePlugin(params, {
							plugin: params.command === 'dev' ? gitDevPlugin(state) : gitBuildPlugin(state),
							warnDuplicated: true,
						});

						debug('Seeding collections from buffer');
						for (const seedOptions of collectionSeedBuffer) {
							seedCollections(state, seedOptions);
						}
					},
				},
				...api,
			};
		},
	})
);

const triggers = Symbol.for('@inox-tools/content-utils:triggers/gitTrackedListResolved');

/**
 * @internal
 */
declare global {
	const globalThis: typeof global & {
		[triggers]: string;
	};
}
