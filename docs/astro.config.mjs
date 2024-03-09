import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
					label: 'Sitemap Extensions',
					link: '/sitemap-ext',
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
		}),
	],
	// markdown: {
	// 	remarkPlugins: [
	// 		() => (tree) => {
	// 			visit(tree, 'code', (node) => {
	// 				console.log(node);
	// 			});
	// 		},
	// 	],
	// }
});
