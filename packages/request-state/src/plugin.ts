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
		load(id, options) {
			if (id !== RESOLVED_MODULE_ID) return;

			const stateSource = options?.ssr ? 'serverState' : 'clientState';

			return `export {setState, getState} from '@inox-tools/request-state/runtime/${stateSource}';`;
		},
	};
};