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
	bundle: true,
	splitting: true,
	dts: true,
	sourcemap: true,
	clean: true,
	minify: true,
	external: dependencies,
	noExternal: devDependencies,
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
