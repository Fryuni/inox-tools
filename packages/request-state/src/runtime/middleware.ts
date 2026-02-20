import { defineMiddleware } from 'astro/middleware';
import { collectState } from './serverState.js';
import { parse } from 'content-type';

export const onRequest = defineMiddleware(async (_, next) => {
	const { getState, result } = await collectState(next);

	const contentType = result.headers.get('Content-Type');

	if (contentType === null) return result;

	const { type: mediaType } = parse(contentType);

	if (mediaType !== 'text/html' && !mediaType.startsWith('text/html+')) return result;

	const originalBody = await result.text();

	let contentLength = Buffer.byteLength(originalBody, 'utf-8');
	result.headers.set('Content-Length', contentLength.toString());

	const state = getState();
	const stateScript = state
		? `<script class="it-astro-state" type="application/json+devalue">${state}</script>`
		: null;
	if (stateScript) {
		const headCloseIndex = originalBody.indexOf('</head>');

		contentLength += Buffer.byteLength(stateScript, 'utf-8');
		result.headers.set('Content-Length', contentLength.toString());

		if (headCloseIndex > -1) {
			return new Response(
				originalBody.slice(0, headCloseIndex) + stateScript + originalBody.slice(headCloseIndex),
				result
			);
		} else {
			return new Response(stateScript + originalBody, result);
		}
	}

	return new Response(originalBody, result);
});
