import type { Plugin } from 'vite';
import { modRegistry } from './state.js';

export { inlineMod } from './inlining.js';

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
		async load(id) {
			if (!id.startsWith('\0')) {
				return null;
			}

			const ref = id.slice(1);

			if (!modRegistry.has(ref)) {
				return null;
			}

			const serializedModule = await modRegistry.get(ref)!;

			return serializedModule.text;
		},
	};
}
