import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

import sitemap from '@astrojs/sitemap';
import inlineModPlugin from '@inox-tools/inline-mod/vite';
import customIntegration from './integration';

// https://astro.build/config
export default defineConfig({
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
		}),
	],
	// vite: {
	// 	plugins: [inlineModPlugin({})]
	// }
});
