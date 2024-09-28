import { defineConfig } from 'tsup';

import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const dependencies = [
	...Object.keys(packageJson.dependencies || {}),
	...Object.keys(packageJson.peerDependencies || {}),
];
const devDependencies = [...Object.keys(packageJson.devDependencies || {})];

export default defineConfig({
	entry: ['src/index.ts', 'src/runtime/*.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: true,
	dts: {
		entry: ['src/index.ts'],
		banner: '/// <reference path="../virtual.d.ts" />\n',
	},
	sourcemap: true,
	clean: true,
	splitting: true,
	minify: false,
	external: [...dependencies, './virtual.d.ts'],
	noExternal: devDependencies,
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
	esbuildOptions: (options) => {
		options.chunkNames = 'chunks/[name]-[hash]';
	},
});
