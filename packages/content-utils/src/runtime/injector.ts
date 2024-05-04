import { injectedCollections, type CollectionConfig } from '@it-astro:content/injector';

export function injectCollections(
	collections: Record<string, CollectionConfig>
): Record<string, CollectionConfig> {
	return {
		...injectedCollections,
		...collections,
	};
}
