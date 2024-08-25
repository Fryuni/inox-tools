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

	export type GitTrackingInfo = {
		earliest: Date;
		latest: Date;
		authors: GitAuthor[];
		coAuthors: GitAuthor[];
	};

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

	/**
	 * Retrieve the Git information about a Content Collection Entry.
	 *
	 * If the entry was never committed, returns `undefined`.
	 */
	export function getEntryGitInfo(...args: EntryKey): Promise<GitTrackingInfo | undefined>;
}

declare namespace Astro {
	export interface IntegrationHooks {
		'@it/content:git:resolved'?: (params: {
			logger: import('astro').AstroIntegrationLogger;
			file: string;
			fileInfo: import('@it-astro:content/git').GitTrackingInfo;
			drop: () => void;
		}) => Promise<void> | void;
		'@it/content:git:listed'?: (params: {
			logger: import('astro').AstroIntegrationLogger;
			trackedFiles: string[];
			ignoreFiles: (files: string[]) => void;
		}) => Promise<void> | void;
	}
}
