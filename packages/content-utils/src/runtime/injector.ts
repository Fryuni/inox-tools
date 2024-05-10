import { injectedCollections, type CollectionConfig } from '@it-astro:content/injector';
import { isFancyCollection, tryGetOriginalFancyCollection } from './fancyContent.js';
import { AstroError } from 'astro/errors';

/**
 * Extend the given collection map with collections defined by integrations.
 *
 * @throws AstroError when conflicts are detected between collections.
 */
export function injectCollections(
	collections: Record<string, CollectionConfig>
): Record<string, CollectionConfig> {
	for (const [key, collection] of Object.entries(collections)) {
		const injectedCollection = injectedCollections[key];
		if (injectedCollection === undefined) continue;

		const originFancyCollection = tryGetOriginalFancyCollection(collection);

		if (originFancyCollection === null) {
			throw new AstroError(
				// TODO: Report which integration added the collection.
				`Content collection "${key}" overrides a collection injected by an integration.`,
				'Try to use a different collection name.'
			);
		}

		// TODO: Detect when two different integrations collide

		if (!Object.is(originFancyCollection, injectedCollection)) {
			throw new AstroError(
				// TODO: Report which integration added the collection.
				`Content collection "${key}" extends from one an injected collection, but overrides a different collection.`,
				'When extending an injected collection you must not change the collection name.'
			);
		}
	}

	const combinedCollections = {
		...injectedCollections,
		...collections,
	};

	const resolvedCollections: Record<string, CollectionConfig> = {};

	for (const [key, value] of Object.entries(combinedCollections)) {
		resolvedCollections[key] = isFancyCollection(value) ? value() : value;
	}

	return resolvedCollections;
}
