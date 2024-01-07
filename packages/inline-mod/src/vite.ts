/**
 * Vite Plugin API
 * https://vitejs.dev/guide/api-plugin.html
 */
import type { Plugin } from 'vite';
import { modRegistry } from './state.js';

export type Options = Record<never, never>;

export default function inlineMod(_options: Options = {}): Plugin {
	return {
		name: '@inox-tools/inline-mod',
		load(id) {
			return modRegistry.get(id);
		},
	};
}
