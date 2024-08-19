import { defineMiddleware } from 'astro/middleware';
import { collectState } from './serverState.js';
import { parse } from 'content-type';

export const onRequest = defineMiddleware(async (_, next) => {
	const { getState, result } = await collectState(next);

	const contentType = result.headers.get('Content-Type');

	if (contentType === null) return result;

	const { type: mediaType } = parse(contentType);

	if (mediaType !== 'text/html' && !mediaType.startsWith('text/html+')) return result;

	const newBody = result.body
		?.pipeThrough(new TextDecoderStream())
		.pipeThrough(injectState(getState))
		.pipeThrough(new TextEncoderStream());

	return new Response(newBody, result);
});

function injectState(getState: () => string | false) {
	let injected = false;
	return new TransformStream({
		transform(chunk, controller) {
			if (!injected) {
				const bodyCloseIndex = chunk.indexOf('</body>');
				if (bodyCloseIndex > -1) {
					const state = getState();
					if (state) {
						const stateScript = `<script id="it-astro-state" type="application/json+devalue">${state}</script>`;

						chunk = chunk.slice(0, bodyCloseIndex) + stateScript + chunk.slice(bodyCloseIndex);
					}
					injected = true;
				}
			}
			controller.enqueue(chunk);
		},
	});
}
