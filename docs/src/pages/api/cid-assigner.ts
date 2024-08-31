import type { APIRoute, AstroCookieSetOptions } from 'astro';
import { randomUUID } from 'crypto';

export const prerender = false;

export function cookieOptions(url: URL): AstroCookieSetOptions {
	return {
		path: '/',
		domain: url.host,
		httpOnly: false,
		secure: url.protocol === 'https:',
		sameSite: 'strict',
		// 1 year
		maxAge: 3600 * 24 * 365,
	};
}

export const GET: APIRoute = (ctx) => {
	const cidParam = new URL(ctx.request.url).searchParams.get('cid');
	const cookie = ctx.cookies.get('croct-cid');
	const cid = cidParam ?? cookie?.value ?? randomUUID().replaceAll('-', '');

	ctx.cookies.set('croct-cid', cid, cookieOptions(ctx.url));
	return new Response(cid, { status: 200 });
};
