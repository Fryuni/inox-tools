import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: true,
	splitting: true,
	dts: true,
	sourcemap: true,
	clean: true,
	minify: false,
	external: ['astro', 'astro-integration-kit', 'vite', 'recast'],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
