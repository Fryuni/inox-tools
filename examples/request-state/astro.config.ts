import { defineConfig } from 'astro/config';
import requestState from '@inox-tools/request-state';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	integrations: [requestState()],
	output: 'server',
	compressHTML: false,
	adapter: node({
		mode: 'standalone',
	}),
});
