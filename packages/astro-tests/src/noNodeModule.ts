/**
 * Copied from: https://github.com/withastro/astro/blob/d2574ad8932039f3eea3bd6d9368bec377a0c334/packages/astro/test/test-plugins.js
 * Modified to check all declared Node built-in modules instead of a small subset.
 */

import type { Plugin } from 'vite';
import { builtinModules } from 'node:module';

const nodeModules = [
	...builtinModules,
	...builtinModules.map((modName) => `node:${modName}`),
	'node:test',
	'node:test/reporters',
	'node:sea',
];

export function preventNodeBuiltinDependencyPlugin(): Plugin {
	// Verifies that the final bundle does not have a hard dependency on Node builtins.
	// This is to verify it will run on Cloudflare and Deno
	return {
		name: 'verify-no-node-stuff',
		generateBundle() {
			nodeModules.forEach((name) => {
				const mod = this.getModuleInfo(name);
				if (mod) {
					throw new Error(`Node builtins snuck in: ${name}`);
				}
			});
		},
	};
}
