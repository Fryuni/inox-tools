import type { ReadableStream } from 'node:stream/web';
import { defineMiddleware } from 'astro/middleware';
import { collectState } from './serverState.js';
import { parse } from 'content-type';

export const onRequest = defineMiddleware(async (_, next) => {
	const { getState, result } = await collectState(next);

	const contentType = result.headers.get('Content-Type');

	if (contentType === null) return result;

	const { type: mediaType } = parse(contentType);

	if (mediaType !== 'text/html' && !mediaType.startsWith('text/html+')) return result;

	async function* render() {
		for await (const chunk of result.body as ReadableStream<ArrayBuffer>) {
			yield chunk;
		}

		const state = getState();

		if (state) {
			yield `<script id="it-astro-state" type="application/json+devalue">${state}</script>`;
		}
	}

	// @ts-expect-error generator not assignable to ReadableStream
	return new Response(render(), result);
});
