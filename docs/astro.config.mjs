import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

const SITE =
	process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: 'https://inox-tools.vercel.app';

// https://astro.build/config
export default defineConfig({
	site: SITE,
	integrations: [
		starlight({
			title: 'Inox Tools',
			social: {
				github: 'https://github.com/Fryuni/inox-tools',
			},
			components: {
				Head: './src/components/Head.astro',
				PageTitle: './src/components/PageTitle.astro',
			},
			sidebar: [
				{
					label: 'Custom Astro Routing',
					link: '/custom-routing',
				},
				{
					label: 'Self Declared Sitemap',
					link: '/declarative-sitemap',
				},
				{
					label: 'Inline Module',
					badge: {
						text: 'NEW',
						variant: 'success',
					},
					autogenerate: { directory: 'inline-mod' },
				},
			],
			plugins: [
				starlightLinksValidator({
					errorOnRelativeLinks: true,
				}),
			],
		}),
	],
});
