import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import requestState from '@inox-tools/request-state';

export default defineConfig({
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	integrations: [requestState()],
});
