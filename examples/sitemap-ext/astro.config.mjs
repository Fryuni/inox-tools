import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@inox-tools/sitemap-ext';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	site: process.env.DEPLOY_SITE ?? 'https://example.com',
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
