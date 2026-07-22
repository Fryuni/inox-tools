import { defineMiddleware } from 'astro/middleware';
import { collectState } from './serverState.js';
import { parse } from 'content-type';

const encoder = new TextEncoder();

export const onRequest = defineMiddleware(async (_, next) => {
	const { getState, result } = await collectState(next);

	const contentType = result.headers.get('Content-Type');

	if (contentType === null) return result;

	const { type: mediaType } = parse(contentType);

	if (mediaType !== 'text/html' && !mediaType.startsWith('text/html+')) return result;

	const originalBody = await result.text();

	const state = getState();
	const stateScript = state
		? `<script class="it-astro-state" type="application/json+devalue">${state}</script>`
		: null;

	if (!stateScript) {
		return new Response(originalBody, result);
	}

	const headCloseIndex = originalBody.indexOf('</head>');
	const finalBody =
		headCloseIndex > -1
			? originalBody.slice(0, headCloseIndex) + stateScript + originalBody.slice(headCloseIndex)
			: stateScript + originalBody;

	// TextEncoder is also supported in CloudFlare Workers, so this should work in all environments Astro supports.
	const encodedBody = encoder.encode(finalBody);
	const contentLength = encodedBody.byteLength;

	const headers = new Headers(result.headers);
	headers.set('Content-Length', contentLength.toString());

	return new Response(encodedBody, {
		status: result.status,
		statusText: result.statusText,
		headers,
	});
});
