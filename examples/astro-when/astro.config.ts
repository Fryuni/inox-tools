import { defineConfig } from 'astro/config';
import astroWhen from '@inox-tools/astro-when';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	integrations: [astroWhen()],
	output: 'server',
	devToolbar: { enabled: false },
	adapter: node({
		mode: 'standalone',
	}),
});
