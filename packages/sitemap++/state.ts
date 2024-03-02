import { type GetStaticPathsItem } from 'astro';

type DynamicSitemapEntry = Pick<GetStaticPathsItem, 'params'> & {
	sitemap?: boolean;
};

function callsites(): NodeJS.CallSite[] {
	const previous = Error.prepareStackTrace;
	try {
		let callsites: NodeJS.CallSite[];
		Error.prepareStackTrace = (_, stack) => {
			callsites = stack;
			return stack;
		};
		new Error().stack;

		return callsites!.slice(1);
	} finally {
		Error.prepareStackTrace = previous;
	}
}

export function setParamsSitemap<T extends DynamicSitemapEntry | DynamicSitemapEntry[]>(
	entries: T
): T {
	const cs = callsites();

	if (Array.isArray(entries)) {
		entries.forEach((e) => setParamsSitemapEntry(e, cs[0]));
	} else {
		setParamsSitemapEntry(entries, cs[0]);
	}

	return entries;
}

function setParamsSitemapEntry(entry: DynamicSitemapEntry, cs: NodeJS.CallSite): void {
	if (entry.sitemap === undefined) return;

	console.log({
		params: entry.params,
		inclusion: entry.sitemap,
		scriptName: cs.getScriptNameOrSourceURL(),
		a: cs.getFileName(),
	});
}

const marker: unique symbol = Symbol('sitemap-marker');

export function includeInSitemap() {
	const cs = callsites();

	console.log('Including:', cs[0].getScriptNameOrSourceURL());

	return marker;
}

export function excludeFromSitemap() {
	const cs = callsites();

	console.log('Excluding:', cs[0].getScriptNameOrSourceURL());

	return marker;
}
