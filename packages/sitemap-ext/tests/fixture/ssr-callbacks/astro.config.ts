import { defineConfig } from 'astro/config';
import sitemap from '@inox-tools/sitemap-ext';

export default defineConfig({
	site: 'https://example.com',
	trailingSlash: 'never',
	integrations: [sitemap()],
});
