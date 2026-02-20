import { defineMiddleware } from 'astro/middleware';
import { collectState } from './serverState.js';
import { parse } from 'content-type';

const _encoder = new TextEncoder();

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
		: '';

	let finalBody = originalBody;

	if (stateScript) {
		const headCloseIndex = originalBody.indexOf('</head>');

		if (headCloseIndex > -1) {
			finalBody =
				originalBody.slice(0, headCloseIndex) +
				stateScript +
				originalBody.slice(headCloseIndex);
		} else {
			finalBody = stateScript + originalBody;
		}
	}
	// TextEncoder is also supported in CloudFlare Workers, so this should work in all environments Astro supports.
	const contentLength = _encoder.encode(finalBody).byteLength;

	const headers = new Headers(result.headers);
	headers.set('Content-Length', contentLength.toString());

	return new Response(finalBody, {
		status: result.status,
		statusText: result.statusText,
		headers,
	});
});
