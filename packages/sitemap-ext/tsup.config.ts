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
	external: ['astro', 'recast', './virtual.d.ts', 'vite', /@astrojs/, /@vitejs/],
	noExternal: ['astro-integration-kit', '@inox-tools/aik-route-config'],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
