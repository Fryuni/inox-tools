import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import requestNanostores from '@inox-tools/request-nanostores';

import preact from '@astrojs/preact';

export default defineConfig({
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	integrations: [requestNanostores(), preact()],
	devToolbar: { enabled: false },
	server: {
		port: 4002
	},
	build:{
		assetsPrefix: "http://localhost:4002/"
	}
});
