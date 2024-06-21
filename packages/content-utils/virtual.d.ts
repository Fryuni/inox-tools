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

declare module '@it-astro:content/git' {
	export type EntryKey =
		| [collection: string, idOrSlug: string]
		| [{ collection: string; id: string }]
		| [{ collection: string; slug: string }];

	/**
	 * Retrieve the latest commit that changed a Content Collection Entry.
	 *
	 * If the entry was never committed, returns a memoized `new Date()`.
	 */
	export function getLatestCommitDate(...args: EntryKey): Promise<Date>;

	/**
	 * Retrieve the oldest commit that changed a Content Collection Entry.
	 *
	 * If the entry was never committed, returns a memoized `new Date()`.
	 */
	export function getOldestCommitDate(...args: EntryKey): Promise<Date>;
}

declare namespace AstroIntegrationKit {
	export interface ExtraHooks {
		'@it-astro:content:gitCommitResolved'?: (params: {
			age: 'oldest' | 'latest';
			file: string;
			resolvedDate: Date;
			overrideDate: (newDate: Date) => void;
		}) => Promise<void>;
		'@it-astro:content:gitTrackedListResolved'?: (params: {
			trackedFiles: string[];
			ignoreFiles: (files: string[]) => void;
		}) => Promise<void>;
	}
}
