import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import customIntegration from './integration';

const configUrl = import.meta.url;

// https://astro.build/config
export default defineConfig({
	output: 'server',
	site: 'https://example.com',
	integrations: [
		mdx(),
		sitemap(),
		customIntegration({
			config: {
				foo: 'bar',
			},
			locals: {
				some: 'thing',
			},
			inlineRoute: (context) => {
				return new Response("Hello, world! I'm running on " + context.generator);
			}
		}),
	],
});
