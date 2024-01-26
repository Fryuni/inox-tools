import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Inox Tools',
			social: {
				github: 'https://github.com/Fryuni/inox-tools',
			},
			sidebar: [
				{
					label: 'Custom Astro Routing',
					link: '/custom-routing',
				},
				{
					label: 'Inline Virtual Module',
					badge: {
						text: 'EXP',
						variant: 'danger',
					},
					autogenerate: { directory: 'inline-mod' },
				},
			],
		}),
	],
});
