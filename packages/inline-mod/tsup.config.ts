import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/vite.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: true,
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: true,
	external: ['vite', 'typescript'],
	tsconfig: 'tsconfig.json',
});
