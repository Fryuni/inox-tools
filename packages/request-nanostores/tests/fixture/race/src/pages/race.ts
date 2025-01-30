import type { APIRoute } from 'astro';
import { identifier } from '../state.js';
import * as timers from 'node:timers/promises';

let requestCount = 0;

export const GET: APIRoute = async (ctx) => {
	const requestId = ++requestCount;
	const delay = Number.parseInt(ctx.url.searchParams.get('delay') as string) || 1000;

	identifier.set(requestId);

	await timers.setTimeout(delay);

	const afterDelay = identifier.get();

	return Response.json({ requestId, afterDelay });
};
