/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'virtual:configuration' {
	declare const config: any;
	export default config;
}

declare module 'virtual:injectedRoute' {
	import type { APIRoute } from 'astro/types';
	export const GET: APIRoute;
}
