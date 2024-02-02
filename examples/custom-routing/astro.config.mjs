import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { strictCustomRouting } from '@inox-tools/custom-routing';

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	integrations: [
		mdx(),
		sitemap(),
		strictCustomRouting({
			'': './src/routes/index.astro',
			about: './src/routes/about.astro',
			blog: './src/routes/blog/index.astro',
			'blog/[...slug]': './src/routes/blog/[...slug].astro',
		}),
	],
});
