import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/vite.ts'],
	format: ['esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: true,
	minify: true,
	external: ['vite', 'typescript'],
	tsconfig: 'tsconfig.json',
});
