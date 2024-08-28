import type { AstroGlobal } from 'astro';
import { debug } from './debug.js';

export type ServerIslandContext = {
	pageUrl: URL;
};

type AnyAstroGlobal = Readonly<Omit<AstroGlobal, 'self' | 'cookies'>>;

/**
 * Retrieve information about the context of the currently executing Server Island.
 *
 * Returns undefined if not currently running inside of a Server Island.
 */
export function getServerIslandContext(astro: AnyAstroGlobal): ServerIslandContext | undefined {
	const { request } = astro;
	const requestUrl = new URL(request.url);

	if (!requestUrl.pathname.startsWith('/_server-islands/')) {
		// Server islands are always served under `/_server-islands`
		return;
	}

	const pageUrlRaw = request.headers.get('referer') ?? request.headers.get('origin');

	if (!pageUrlRaw) {
		debug('Request to Server Island not sent from a browser, missing browser-injected headers');
		return;
	}

	return {
		pageUrl: new URL(pageUrlRaw),
	};
}

/**
 * Get the current page URL accounting for requests to Server Islands.
 *
 * If the current component is being loaded as part of a Server Island,
 * returns the URL of the page containing the Server Island.
 * Otherwise, the page for the current request is returned.
 */
export function currentPageUrl(astro: AnyAstroGlobal): URL {
	return getServerIslandContext(astro)?.pageUrl ?? astro.url;
}
