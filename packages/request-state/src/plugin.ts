import { createResolver } from 'astro-integration-kit';
import type { Plugin } from 'vite';

const MODULE_ID = '@it-astro:state';
const RESOLVED_MODULE_ID = `\x00${MODULE_ID}`;

export const plugin = (): Plugin => {
	const { resolve } = createResolver(import.meta.url);

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

			const stateSource = options?.ssr ? 'serverState.js' : 'clientState.js';
			const importPath = resolve('runtime', stateSource);

			return `
export {setState, getState, hasState} from '${importPath}';
export {ServerStateLoaded} from '${resolve('events.js')}';
`.trim();
		},
	};
};
