declare module '@it-astro:content' {
	export { z, reference } from 'astro:content';
	export type {
		SchemaContext,
		CollectionEntry,
		ContentCollectionKey,
		CollectionKey,
	} from 'astro:content';

	export { defineCollection } from '@inox-tools/content-utils/runtime/fancyContent';
}

declare module '@it-astro:content/injector' {
	import type { defineCollection } from 'astro:content';
	import type { FancyCollection } from '@inox-tools/content-utils/runtime/fancyContent';

	export type CollectionConfig = ReturnType<typeof defineCollection>;
	export const injectedCollections: Record<string, CollectionConfig | FancyCollection>;
}
