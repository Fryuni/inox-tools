import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import serverIslands from '@inox-tools/server-islands';

export default defineConfig({
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	integrations: [serverIslands()],
});
