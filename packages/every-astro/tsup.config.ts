import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node22',
	banner: { js: '#!/usr/bin/env node' },
	bundle: true,
	sourcemap: true,
	clean: true,
	splitting: true,
	minify: true,
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
