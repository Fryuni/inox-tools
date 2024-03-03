import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@inox-tools/sitemap++';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	integrations: [
		mdx(),
		sitemap({
			includeByDefault: true,
		}),
	],
	output: 'server',
	adapter: node({
		mode: 'standalone',
	}),
});
