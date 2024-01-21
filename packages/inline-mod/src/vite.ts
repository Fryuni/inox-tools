/**
 * Vite Plugin API
 * https://vitejs.dev/guide/api-plugin.html
 */
import type { Plugin } from 'vite';
import { modRegistry } from './state.js';

export type Options = Record<never, never>;

export default function inlineModPlugin(_options: Options = {}): Plugin {
	return {
		name: '@inox-tools/inline-mod',
		resolveId(id) {
			if (modRegistry.has(id)) {
				return '\0' + id;
			}
			return null;
		},
		load(id) {
			if (!id.startsWith('\0inox:inline-mod:')) {
				return null;
			}

			const ref = id.slice(1);

			return modRegistry.get(ref);
		},
	};
}
