import { debug } from './internal/debug.js';
import { runtimeLogger } from '@inox-tools/runtime-logger';
import type { AstroIntegration } from 'astro';

export default function portalGun(): AstroIntegration {
	return {
		name: '@inox-tools/portal-gun',
		hooks: {
			'astro:config:setup': (params) => {
				runtimeLogger(params, {
					name: 'portal-gun',
				});

				debug('Injecting middleware');
				params.addMiddleware({
					order: 'pre',
					entrypoint: new URL('./runtime/middleware.js', import.meta.url),
				});
			},
		},
	};
}
