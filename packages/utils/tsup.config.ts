import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const dependencies = [
	...Object.keys(packageJson.dependencies || {}),
	...Object.keys(packageJson.peerDependencies || {}),
];
const devDependencies = [...Object.keys(packageJson.devDependencies || {})];

export default defineConfig({
	entry: ['src/**/*.ts'],
	format: ['esm'],
	target: 'node18',
	bundle: false,
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: true,
	external: dependencies,
	noExternal: devDependencies,
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
