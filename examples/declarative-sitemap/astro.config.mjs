import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@inox-tools/declarative-sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	integrations: [mdx(), sitemap()],
});
