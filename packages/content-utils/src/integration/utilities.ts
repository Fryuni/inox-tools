import { defineUtility } from 'astro-integration-kit';
import type { SeedCollectionsOptions } from './seedCollections.js';
import { type InjectCollectionOptions, integration } from './index.js';
import type { HookParameters } from 'astro';

/**
 * Inject a content collection definition alongside the project.
 *
 * Collections defined here can be overriden by the project.
 */
export const injectCollections = defineUtility('astro:config:setup')((
	params: HookParameters<'astro:config:setup'>,
	options: InjectCollectionOptions
) => {
	const api = integration.fromSetup(params);

	return api.injectCollection(options);
});

export const seedCollections = defineUtility('astro:config:setup')((
	params: HookParameters<'astro:config:setup'>,
	options: SeedCollectionsOptions
) => {
	const api = integration.fromSetup(params);

	api.seedCollections(options);
});
