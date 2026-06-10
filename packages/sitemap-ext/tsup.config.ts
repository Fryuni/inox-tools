import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['index.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: true,
	dts: {
		banner: '/// <reference path="../virtual.d.ts" />\n',
	},
	sourcemap: true,
	clean: true,
	splitting: true,
	minify: false,
	external: ['astro', '@inox-tools/route-config', '@astrojs/sitemap', './virtual.d.ts', 'vite'],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
