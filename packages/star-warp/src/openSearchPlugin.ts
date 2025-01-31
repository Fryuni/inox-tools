import type { Plugin } from 'vite';

type Params = (typeof import('@it-astro:star-warp:openSearch'))['default'];

const MODULE_ID = '@it-astro:star-warp:openSearch';
const RESOLVED_MODULE_ID = '\x00@it-astro:star-warp:openSearch';

export const makeOpenSearchPlugin = (params: Params): Plugin => {
	return {
		name: '@inox-tools/star-warp/openSearchPlugin',
		resolveId(id) {
			if (id === MODULE_ID) return RESOLVED_MODULE_ID;
		},
		load(id) {
			if (id === RESOLVED_MODULE_ID) {
				return `export default ${JSON.stringify(params)}`;
			}
		},
	};
};
