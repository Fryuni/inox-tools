import { whenAmI } from '@it-astro:when';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => {
  return new Response(whenAmI);
}
