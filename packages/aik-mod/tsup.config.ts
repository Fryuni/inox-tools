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
	minify: true,
	external: ['astro-integration-kit', 'astro', '@inox-tools/inline-mod'],
	tsconfig: 'tsconfig.json',
});
