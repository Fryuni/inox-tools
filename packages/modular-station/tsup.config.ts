import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

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
	bundle: false,
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: false,
	external: [...dependencies, 'vite', './virtual.d.ts'],
	noExternal: devDependencies,
	treeshake: 'smallest',
	tsconfig: 'tsconfig.json',
});
