import type { SeedCollectionsOptions } from './seedCollections.js';
import { type InjectCollectionOptions, integration } from './index.js';
import type { IntegrationFromSetup } from '@inox-tools/modular-station';

/**
 * Inject a content collection definition alongside the project.
 *
 * Collections defined here can be overriden by the project.
 */
export function injectCollections(params: IntegrationFromSetup, options: InjectCollectionOptions) {
	const api = integration.fromSetup(params);

	return api.injectCollection(options);
}

export function seedCollections(params: IntegrationFromSetup, options: SeedCollectionsOptions) {
	const api = integration.fromSetup(params);

	api.seedCollections(options);
}
