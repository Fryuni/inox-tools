import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import type { StarlightConfig } from '@astrojs/starlight/types';
import vercel from '@astrojs/vercel';
import starWarp from '@inox-tools/star-warp';
import starlightLinksValidator from 'starlight-links-validator';
import starlightCoolerCredit from 'starlight-cooler-credit';

const badge = {
	new: {
		text: 'NEW',
		variant: 'success',
	},
	updated: {
		text: 'UPDATED',
		variant: 'default',
	},
} satisfies Record<string, NonNullable<NonNullable<StarlightConfig['sidebar']>[number]['badge']>>;

process.env.ASTRO_PROJECT_ROOT = new URL('../', import.meta.url).toString();

const SITE =
	process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: 'https://inox-tools.fryuni.dev';

// https://astro.build/config
export default defineConfig({
	adapter: vercel({
		skewProtection: true,
	}),
	site: SITE,
	trailingSlash: 'never',
	integrations: [
		starlight({
			title: 'Inox Tools',
			favicon: '/favicon.png',
			credits: true,
			lastUpdated: true,
			editLink: { baseUrl: 'https://github.com/Fryuni/inox-tools/edit/main/docs' },
			pagination: false,
			social: {
				github: 'https://github.com/Fryuni/inox-tools',
				discord: 'https://discord.com/channels/830184174198718474/1197638002764152843',
			},
			components: {
				Head: './src/components/Head.astro',
				PageTitle: './src/components/PageTitle.astro',
				Sidebar: './src/components/Sidebar.astro',
				MarkdownContent: './src/components/MarkdownContent.astro',
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
						},
						{
							label: 'Astro When',
							link: '/astro-when',
						},
						{
							label: 'Runtime Logger',
							link: '/runtime-logger',
						},
						{
							label: 'Star Warp',
							link: '/star-warp',
						},
						{
							label: 'Request State',
							link: '/request-state',
						},
						{
							label: 'Request Nanostores',
							link: '/request-nanostores',
						},
						{
							label: 'Cut Short',
							link: '/cut-short',
						},
						{
							label: 'Portal Gun',
							link: '/portal-gun',
						},
						{
							label: 'Server Islands',
							link: '/server-islands',
						},
						{
							label: 'Content Utilities',
							collapsed: false,
							autogenerate: {
								directory: 'content-utils',
							},
						},
					],
				},
				{
					label: 'Tools for Authors',
					collapsed: false,
					items: [
						{
							label: 'Astro Integration Kit',
							link: 'https://astro-integration-kit.netlify.app',
						},
						{
							label: 'Astro Tests',
							link: '/astro-tests',
						},
						{
							label: 'Modular Station',
							collapsed: false,
							autogenerate: {
								directory: 'modular-station',
							},
						},
						{
							label: 'Inline Module',
							collapsed: true,
							autogenerate: { directory: 'inline-mod' },
						},
					],
				},
			],
			plugins: [
				starlightLinksValidator({
					errorOnRelativeLinks: true,
				}),
				starlightCoolerCredit({
					credit: {
						title: 'Built for Astro',
						description: 'Use these tools on your Astro project',
						href: 'https://docs.astro.build',
					},
				}),
				starWarp(),
			],
		}),
	],
	redirects: {
		'/content-utils/git': '/content-utils',
		'/content-utils/git-time': '/content-utils',
		'/modular-station': '/modular-station/api',
	},
	image: {
		domains: ['mermaid.ink'],
	},
});
