import type { AstroIntegration } from 'astro';
import { debug } from './runtime/debug.js';

const MODULE_ID = '@it-astro:server-islands';
const RESOLVED_MODULE_ID = `\x00${MODULE_ID}`;

export default function serverIslands(): AstroIntegration {
	return {
		name: '@inox-tools/server-islands',
		hooks: {
			'astro:config:setup': (params) => {
				params.updateConfig({
					vite: {
						plugins: [
							{
								name: '@inox-tools/server-islands',
								resolveId(id) {
									if (id === MODULE_ID) return RESOLVED_MODULE_ID;
								},
								load(id) {
									if (id !== RESOLVED_MODULE_ID) return;

									debug('Virtual module loaded');
									return `export * from ${JSON.stringify(new URL('./runtime/lib.js', import.meta.url))};`;
								},
							},
						],
					},
				});
			},
		},
	};
}
