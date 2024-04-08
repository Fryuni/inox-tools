import { whenAmI, When } from '@it-astro:when';
import type { MiddlewareHandler } from 'astro';

const middlewares: Record<When, MiddlewareHandler> = {
	[When.Client]: () => {
		throw new Error('Client should not run a middleware!');
	},
	[When.DevServer]: (_, next) => {
		console.log('Running middleware on dev server');
		return next();
	},
	[When.Server]: (_, next) => {
		console.log('Running middleware on server for a server route');
		return next();
	},
	[When.Prerender]: (_, next) => {
		console.log('Running middleware while prerendering a route during build for an SSR output');
		return next();
	},
	[When.StaticBuild]: (_, next) => {
		console.log(
			'Running middleware while rendering a route during build for a fully static output'
		);
		return next();
	},
};

export const onRequest = middlewares[whenAmI];
