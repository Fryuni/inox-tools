import type { AstroIntegration } from 'astro';
import { plugin } from './plugin.js';
import requestState from '@inox-tools/request-state';

export default function requestNanostores(): AstroIntegration {
	return {
		name: '@inox-tools/request-nanostores',
		hooks: {
			'astro:config:setup': (params) => {
				if (!params.config.integrations.some((e) => e.name === '@inox-tools/request-state')) {
					params.logger.debug('Adding request-state integration');
					params.updateConfig({
						integrations: [requestState()],
					});
				}

				params.updateConfig({
					vite: {
						plugins: [plugin()],
					},
				});
			},
		},
	};
}
