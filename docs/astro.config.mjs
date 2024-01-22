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
					label: 'Inline Virtual Module',
					autogenerate: { directory: 'inline-mod' },
				},
			],
		}),
	],
});
