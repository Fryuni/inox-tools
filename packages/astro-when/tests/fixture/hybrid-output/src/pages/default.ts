import { whenAmI } from '@it-astro:when';
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
	return new Response(whenAmI);
};
