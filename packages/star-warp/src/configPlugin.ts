import type { Plugin } from 'vite';

type Config = {
	env: string;
	trailingSlash: string;
};

const MODULE_ID = '@it-astro:star-warp:config';
const RESOLVED_MODULE_ID = '\x00@it-astro:star-warp:config';

export function makePlugin(config: Config): Plugin {
	return {
		name: '@inox-tools/star-warp/configPlugin',
		resolveId(id) {
			if (id === MODULE_ID) return RESOLVED_MODULE_ID;
		},
		load(id) {
			if (id === RESOLVED_MODULE_ID) {
				return `export default ${JSON.stringify(config)}`;
			}
		},
	};
}
