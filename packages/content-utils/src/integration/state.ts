import type { AstroIntegrationLogger } from 'astro';
import type { ResolvedContentPaths } from '../internal/resolver.js';

export interface IntegrationState {
	logger: AstroIntegrationLogger;
	injectedCollectionsEntrypoints: string[];
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
