import { defineConfig } from 'astro/config';
import nodejs from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import serverIslandTools from '@inox-tools/server-islands';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: nodejs({ mode: 'standalone' }),
	integrations: [react(), tailwind({ applyBaseStyles: false }), serverIslandTools()],
	devToolbar: { enabled: false },
});
