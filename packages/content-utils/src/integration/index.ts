import { withApi, onHook, registerGlobalHooks } from '@inox-tools/modular-station';
import { emptyState, type IntegrationState } from './state.js';
import { resolveContentPaths } from '../internal/resolver.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { addVitePlugin, defineIntegration } from 'astro-integration-kit';
import { injectorPlugin } from './injectorPlugin.js';
import { seedCollections, type SeedCollectionsOptions } from './seedCollections.js';
import { gitBuildPlugin, gitDevPlugin } from './gitPlugin.js';
import { debug } from '../internal/debug.js';
import * as devalue from 'devalue';
import { z } from 'astro/zod';

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
		optionsSchema: z
			.object({
				staticOnlyCollections: z.array(z.string()).optional().default([]),
				collectCommitHistory: z.boolean().optional().default(true),
			})
			.optional()
			.default({}),
		setup: ({ options: { staticOnlyCollections, collectCommitHistory } }) => {
			debug('Generating empty state');
			const state = emptyState();
			state.staticOnlyCollections.push(...staticOnlyCollections);
			state.collectCommitHistory = collectCommitHistory;
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
					'astro:build:done': async () => {
						await clearStaticCollections(state);
						for (const cleanup of state.cleanups) {
							await cleanup();
						}
					},
				},
				...api,
			};
		},
	})
);

async function clearStaticCollections(state: IntegrationState) {
	// After the build is done, if there was such a chunk and there are collections
	// that should only be present during static build, clean them.
	if (
		!(
			state.staticOnlyCollections.length > 0 &&
			state.contentDataEntrypoint &&
			existsSync(state.contentDataEntrypoint)
		)
	)
		return;

	const originalContent = readFileSync(state.contentDataEntrypoint, 'utf-8');

	// Content was already cleared by Astro. Collections are not used anywhere on server bundle
	if (!originalContent.includes('export')) return;

	// Import the chunk, which exports a devalue flattened map as the default export
	const { default: value } = await import(/*@vite-ignore*/ state.contentDataEntrypoint);

	// Unflatten the map
	const map: Map<string, Map<string, unknown>> = devalue.unflatten(value);

	// Remove all the collections we promise we won't use on the server
	for (const collection of state.staticOnlyCollections) {
		map.delete(collection);
	}

	// Build the source code with the new map flattened
	const newContent = [
		`const _astro_dataLayerContent = ${devalue.stringify(map)}`,
		'\nexport { _astro_dataLayerContent as default }',
	].join('\n');

	// Write it back
	writeFileSync(state.contentDataEntrypoint, newContent, 'utf-8');
}

const triggers = Symbol.for('@inox-tools/content-utils:triggers/gitTrackedListResolved');

/**
 * @internal
 */
declare global {
	const globalThis: typeof global & {
		[triggers]: string;
	};
}
