import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts', 'src/vite.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: true,
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: true,
	// Vite emits a giant wall of warnings when minifying this lib because it gets
	// lost on the renamed import calls.
	minify: false,
	external: ['vite', 'debug', 'typescript'],
	tsconfig: 'tsconfig.json',
});
