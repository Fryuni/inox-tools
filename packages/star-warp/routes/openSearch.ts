import config from '@it-astro:star-warp:openSearch';
import type { APIRoute } from 'astro';

const value = `<?xml version="1.0"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${config.siteName}</ShortName>
  <Description>${config.description}</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="text/html" method="get" template="${config.searchURL}?q={searchTerms}"/>
</OpenSearchDescription>`;

export const prerender = true;

export const GET: APIRoute = async () => {
	return new Response(value, {
		headers: {
			'Content-Type': 'application/opensearchdescription+xml',
		},
	});
};
