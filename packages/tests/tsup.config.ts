import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const dependencies = [
	...Object.keys(packageJson.dependencies || {}),
	...Object.keys(packageJson.peerDependencies || {}),
].map((name) => new RegExp(`^${name}/?$`));
const devDependencies = [...Object.keys(packageJson.devDependencies || {})]
	.filter((name) => !['vite'].includes(name))
	.map((name) => new RegExp(`^${name}/?$`));

export default defineConfig({
	entry: ['src/**/*.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: true,
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: true,
	minify: false,
	external: [...dependencies, 'vite', './virtual.d.ts'],
	noExternal: [
		...devDependencies,
		// To inline the internal pieces of Astro that are needed for testing
		// but not exposed on the public API
		/^..\/node_modules\/astro\/dist\/core/,
	],
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
	esbuildOptions: (options) => {
		options.chunkNames = 'chunks/[name]-[hash]';
	},
});
