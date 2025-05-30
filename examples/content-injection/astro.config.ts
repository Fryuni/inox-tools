import { defineConfig } from 'astro/config';
import integration from './integration';
import runtimeLogger from '@inox-tools/runtime-logger';
import contentUtils from '@inox-tools/content-utils';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	integrations: [
		runtimeLogger(),
		contentUtils({
			staticOnlyCollections: ['blog'],
		}),
		integration(),
	],
});
