import type { APIContext, AstroGlobal, MiddlewareHandler } from 'astro';
import { debug } from '../internal/debug.js';
import { CarrierError, LOCALS_KEY } from '../internal/carrier.js';

type ControlState = {
	innerError?: unknown;
	response?: AstroGlobal['response'];
};

declare global {
	namespace App {
		interface Locals {
			[LOCALS_KEY]: ControlState;
		}
	}
}

export const onRequest: MiddlewareHandler = async (ctx, next) => {
	try {
		const state: ControlState = (ctx.locals[LOCALS_KEY] = {});

		const res = await next();
		const body = await awaitBodyWithoutChange(ctx, res.body);

		if (state.innerError) {
			if (state.innerError instanceof CarrierError) {
				debug('Returning response from inner carrier from the context');
				return state.innerError.getResponse();
			}

			// Allow errors from components to propagate to the page and show the 500 error page
			throw state.innerError;
		}

		// Combine headers that might be set after initial section
		const headers = new Headers(state.response?.headers);
		for (const [header, value] of res.headers.entries()) {
			// Avoid header duplication
			if (headers.get(header) === value) continue;
			headers.append(header, value);
		}

		return new Response(body, {
			headers,
			status: state.response?.status ?? res.status,
			statusText: state.response?.statusText ?? res.statusText,
		});
	} catch (err: unknown) {
		if (err instanceof CarrierError) {
			debug('Returning response from CarrierError');
			return err.getResponse();
		}

		throw err;
	}
};

async function awaitBodyWithoutChange(
	ctx: APIContext,
	body: ReadableStream | null
): Promise<ReadableStream | null> {
	if (!body) return null;

	const chunks: Array<{ k: 'chunk' | 'error'; v: any }> = [];

	try {
		for await (const chunk of body) {
			chunks.push({ k: 'chunk', v: chunk });
		}
	} catch (error) {
		if (import.meta.env.DEV === true) {
			chunks.push({ k: 'error', v: error });
		} else {
			throw error;
		}
	}

	if (import.meta.env.DEV === true && ctx.props.error) {
		debug('Propagating error from previous page for dev overlay');
		chunks.push({ k: 'error', v: ctx.props.error });
	}

	// Construct a pull-based stream so errors get propagated in the right stage of the dev warning pipeline
	return new ReadableStream({
		pull(controller) {
			const chunk = chunks.shift();
			switch (chunk?.k) {
				case 'chunk':
					controller.enqueue(chunk.v);
					break;
				case 'error':
					controller.error(chunk.v);
					throw chunk.v;
				default:
					controller.close();
					break;
			}
		},
	});
}
