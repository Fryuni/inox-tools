import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import cutShort from '@inox-tools/cut-short';
import sitemap from '@inox-tools/sitemap-ext';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	site: process.env.DEPLOY_SITE ?? 'https://example.com',
	integrations: [
		mdx(),
		cutShort(),
		sitemap({
			includeByDefault: true,
		}),
	],
	output: 'server',
	adapter: node({
		mode: 'standalone',
	}),
});
