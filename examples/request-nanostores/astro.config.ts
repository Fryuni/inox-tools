import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import requestNanostores from '@inox-tools/request-nanostores';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	// Enable many frameworks to support all different kinds of components.
	integrations: [preact(), requestNanostores()],
	compressHTML: false,
	output: 'server',
	adapter: node({
		mode: 'standalone',
	}),
	experimental: {
		actions: true,
	},
});
