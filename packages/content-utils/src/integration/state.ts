import type { AstroIntegrationLogger } from 'astro';
import type { ResolvedContentPaths } from '../internal/resolver.js';

export interface IntegrationState {
	logger: AstroIntegrationLogger;
	injectedCollectionsEntrypoints: string[];
	staticOnlyCollections: string[];
	contentPaths: ResolvedContentPaths;
	contentDataEntrypoint?: string;
	collectCommitHistory: boolean;
	cleanups: (() => Promise<void>)[];
}

export function emptyState(): IntegrationState {
	return {
		injectedCollectionsEntrypoints: [],
		staticOnlyCollections: [],
		collectCommitHistory: true,
		cleanups: [],
	} as Partial<IntegrationState> as IntegrationState;
}
