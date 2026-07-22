import type { AstroIntegration } from 'astro';
import { plugin } from './plugin.js';

export default function requestState(): AstroIntegration {
	return {
		name: '@inox-tools/request-state',
		hooks: {
			'astro:config:setup': (params) => {
				params.logger.debug('Adding request-state middleware');
				params.addMiddleware({
					order: 'pre',
					entrypoint: new URL('./runtime/middleware.js', import.meta.url),
				});

				params.logger.debug('Adding request-state virtual module');
				params.updateConfig({
					vite: {
						plugins: [plugin()],
					},
				});
			},
		},
	};
}
