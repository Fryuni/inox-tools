import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: true,
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: false,
	external: ['astro', 'astro-integration-kit', 'vite', 'recast', /@astrojs/, /@vitejs/],
	noExternal: [],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
