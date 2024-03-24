import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['cjs'],
	target: 'node18',
	banner: { js: '#!/usr/bin/env node' },
	bundle: true,
	sourcemap: true,
	clean: true,
	splitting: true,
	minify: true,
	external: [],
	noExternal: ['@lunariajs/core'],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
