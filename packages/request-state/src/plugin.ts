import type { Plugin } from 'vite';

const MODULE_ID = '@it-astro:state';
const RESOLVED_MODULE_ID = `\x00${MODULE_ID}`;

export const plugin = (): Plugin => {
	return {
		name: '@inox-tools/request-state/vite-plugin',
		resolveId(id) {
			if (id === MODULE_ID) {
				return RESOLVED_MODULE_ID;
			}
		},
		config(config) {
			if (config.ssr?.external === true) return;

			config.ssr = {
				...config.ssr,
				external: [...(config.ssr?.external ?? []), 'node:async_hooks'],
			};
		},
		load(id, options) {
			if (id !== RESOLVED_MODULE_ID) return;

			return `
export {setState, getState, hasState} from ${JSON.stringify(new URL(`./runtime/${options?.ssr ? 'server' : 'client'}State.js`, import.meta.url))};
export {ServerStateLoaded} from ${JSON.stringify(new URL('./events.js', import.meta.url))};
`.trim();
		},
	};
};
