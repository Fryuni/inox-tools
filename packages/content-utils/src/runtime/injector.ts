import { injectedCollections, type CollectionConfig } from '@it-astro:content/injector';
import { FANCY_COLLECTION_MARKER, type FancyCollection } from './fancyContent.js';
import { AstroError } from 'astro/errors';

export function injectCollections(
	collections: Record<string, CollectionConfig>
): Record<string, CollectionConfig> {
	for (const [key, collection] of Object.entries(collections)) {
		const injectedCollection = injectedCollections[key];
		if (injectedCollection === undefined) continue;

		if (!isExtendedCollection(collection)) {
			throw new AstroError(
				// TODO: Report which integration added the collection.
				`Content collection "${key}" overrides a collection injected by an integration.`,
				'Try to use a different collection name.'
			);
		}

		const originFn = collection[FANCY_COLLECTION_MARKER];

		if (!Object.is(originFn, injectedCollection)) {
			throw new AstroError(
				// TODO: Report which integration added the collection.
				`Content collection "${key}" extends from one an injected collection, but overrides a different collection.`,
				'When extending an injected collection you must not change the collection name.'
			);
		}
	}

	const resolvedInjectedCollections: Record<string, CollectionConfig> = {};

	for (const [key, value] of Object.entries(injectedCollections)) {
		if (collections[key] !== undefined) continue;

		resolvedInjectedCollections[key] = isFancyCollection(value) ? value() : value;
	}

	return {
		...resolvedInjectedCollections,
		...collections,
	};
}

type ExtendedCollection = {
	[FANCY_COLLECTION_MARKER]: Function;
};

function isExtendedCollection(something: any): something is ExtendedCollection {
	return typeof something[FANCY_COLLECTION_MARKER] === 'function';
}

function isFancyCollection(something: any): something is FancyCollection {
	return something[FANCY_COLLECTION_MARKER] === true;
}
