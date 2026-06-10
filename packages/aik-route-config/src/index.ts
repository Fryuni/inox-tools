import { definePlugin } from 'astro-integration-kit';
import { defineRouteConfig, type PerRouteConfigOptions } from '@inox-tools/route-config';

export default definePlugin({
	name: 'defineRouteConfig',
	setup: () => {
		return {
			'astro:config:setup': (params) => ({
				defineRouteConfig: <T = any>(options: PerRouteConfigOptions<T>) =>
					defineRouteConfig(params, options),
			}),
		};
	},
});
