import type { AstroIntegrationLogger } from 'astro';
import type { ResolvedContentPaths } from '../internal/resolver.js';

export interface InjectedCollectionEntry {
	entrypoint: string;
	integrationName?: string;
}

export interface IntegrationState {
	logger: AstroIntegrationLogger;
	injectedCollectionsEntrypoints: InjectedCollectionEntry[];
	staticOnlyCollections: string[];
	contentPaths: ResolvedContentPaths;
	contentDataEntrypoint?: string;
	cleanups: (() => Promise<void>)[];
}

export function emptyState(): IntegrationState {
	return {
		injectedCollectionsEntrypoints: [],
		staticOnlyCollections: [],
		cleanups: [],
	} as Partial<IntegrationState> as IntegrationState;
}
