import { withApi, onHook } from '@inox-tools/modular-station';
import { emptyState } from './state.js';
import { resolveContentPaths } from '../internal/resolver.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { addVitePlugin, type HookParameters } from 'astro-integration-kit';
import { injectorPlugin } from './injectorPlugin.js';
import { seedCollections, type SeedCollectionsOptions } from './seedCollections.js';
import { gitTimeBuildPlugin, gitTimeDevPlugin } from './gitTimePlugin.js';

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

export const integration = withApi(() => {
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
				if (state.contentPaths === undefined) {
					collectionSeedBuffer.push(options);
				} else {
					seedCollections(state, options);
				}
			}
		),
	};

	return {
		name: '@inox-tools/content-utils',
		hooks: {
			'astro:config:setup': (params: HookParameters<'astro:config:setup'>) => {
				state.logger = params.logger;

				state.contentPaths = resolveContentPaths(params.config);

				if (!state.contentPaths.configExists) {
					// Create the `<srcDir>/content/config.ts` file if it doesn't exist,
					// otherwise there is no module to modify in the Vite lifecycle.

					mkdirSync(state.contentPaths.contentPath, { recursive: true });
					writeFileSync(state.contentPaths.configPath, 'export const collections = {};');
				}

				addVitePlugin(params, {
					plugin: injectorPlugin(state),
					warnDuplicated: true,
				});

				addVitePlugin(params, {
					plugin: params.command === 'dev' ? gitTimeDevPlugin(state) : gitTimeBuildPlugin(state),
					warnDuplicated: true,
				});

				for (const seedOptions of collectionSeedBuffer) {
					api.seedCollections(seedOptions);
				}
			},
		},
		...api,
	};
});
