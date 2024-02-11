import { defineConfig } from 'astro/config';
import customIntegration, { factory, asyncFactory } from './integration';
import node from '@astrojs/node';

const configUrl = import.meta.url;

// https://astro.build/config
export default defineConfig({
	output: 'server',
	site: 'https://example.com',
	adapter: node({
		mode: 'standalone',
	}),
	integrations: [
		customIntegration({
			// Async factory values are awaited in runtmie and the resolved value is exported from
			// the defined module as if it was inline.
			config: asyncFactory(async () => {
				// Fetch configuration from some remote place when the server is initialized
				const res = await fetch('https://httpbin.org/json');
				return res.json();
			}),
			locals: {
				// Plain values are serialized and made available in runtime
				build: {
					now: new Date(),
				},
				// A factory value gets reconstructed when the module is first imported at runtime
				moduleInitialization: factory(() => ({
					now: new Date(),
				})),
			},
			inlineMiddleware: (context, next) => {
				context.locals.middlewarePerRequestValues = {
					now: new Date(),
					addedFrom: configUrl,
				};

				return next();
			},
			inlineRoute: (context) => {
				return new Response(
					`Hello, world! I'm running on ${context.generator}.\n` +
						`And I was defined in ${configUrl}`
				);
			},
		}),
	],
});
