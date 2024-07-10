import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/*.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: false,
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: false,
	external: ['astro', 'astro-integration-kit', 'vite', /^@inox-tools\//],
	noExternal: [],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
