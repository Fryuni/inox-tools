import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/**/*.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: false,
	dts: {
		entry: ['src/index.ts'],
		banner: '/// <reference path="../virtual.d.ts" />\n',
	},
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: true,
	external: [
		'astro',
		'astro-integration-kit',
		'devalue',
		'./virtual.d.ts',
		'vite',
		'@inox-tools/utils',
	],
	noExternal: [],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
