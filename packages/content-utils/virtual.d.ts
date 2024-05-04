declare module '@it-astro:content/injector' {
	import type { defineCollection } from 'astro:content';
	export type CollectionConfig = ReturnType<typeof defineCollection>;
	export const injectedCollections: Record<string, CollectionConfig>;
}
