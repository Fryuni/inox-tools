import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/*.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: false,
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: true,
	dts: true,
	external: [],
	noExternal: [],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
