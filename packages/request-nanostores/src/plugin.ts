import type { Plugin } from 'vite';

const MODULE_ID = '@it-astro:request-nanostores';
const RESOLVED_MODULE_ID = `\x00${MODULE_ID}`;

export const plugin = (): Plugin => {
	return {
		name: '@inox-tools/request-nanostores/plugin',
		resolveId(id) {
			if (id === MODULE_ID) return RESOLVED_MODULE_ID;
		},
		load(id, options = {}) {
			if (id !== RESOLVED_MODULE_ID) return;

			const source = options.ssr ? 'server' : 'client';

			return `
export { shared } from '@inox-tools/request-nanostores/runtime/${source}';
        `.trim();
		},
	};
};
