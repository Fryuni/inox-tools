import type { AstroIntegrationLogger } from 'astro';
import type { ResolvedContentPaths } from '../internal/resolver.js';

export interface IntegrationState {
	logger: AstroIntegrationLogger;
	injectedCollectionsEntrypoints: string[];
	contentPaths: ResolvedContentPaths;
}

export function emptyState(): IntegrationState {
	return {
		injectedCollectionsEntrypoints: [],
	} as Partial<IntegrationState> as IntegrationState;
}
