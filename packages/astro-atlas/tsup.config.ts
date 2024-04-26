import { defineConfig } from 'tsup';

export default defineConfig({
	entry: [
		'src/index.ts',
		'src/middleware.ts',
		'src/types.ts',
		'src/state.ts',
	],
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
	external: [
		'astro',
		'astro-integration-kit',
		'./virtual.d.ts',
		'vite',
		/^@it-astro:/
	],
	noExternal: [],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
