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
			favicon: '/favicon.png',
			social: {
				github: 'https://github.com/Fryuni/inox-tools',
				discord: 'https://discord.com/channels/830184174198718474/1197638002764152843',
			},
			components: {
				Head: './src/components/Head.astro',
				PageTitle: './src/components/PageTitle.astro',
			},
			sidebar: [
				{
					label: 'Tiny and Cute Integrations',
					collapsed: false,
					items: [
						{
							label: 'Custom Astro Routing',
							link: '/custom-routing',
						},
						{
							label: 'Sitemap Extensions',
							link: '/sitemap-ext',
							badge: {
								text: 'NEW',
								variant: 'success',
							},
						},
					],
				},
				{
					label: 'Inline Module',
					collapsed: false,
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
