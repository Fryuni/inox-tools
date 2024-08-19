import {
	defineIntegration,
	hasIntegration,
	addIntegration,
	addVitePlugin,
} from 'astro-integration-kit';
import { plugin } from './plugin.js';
import requestState from '@inox-tools/request-state';

export default defineIntegration({
	name: '@inox-tools/request-nanostores',
	setup() {
		return {
			hooks: {
				'astro:config:setup': (params) => {
					if (!hasIntegration(params, { name: '@inox-tools/request-state' })) {
						params.logger.debug('Adding request-state integration');
						addIntegration(params, {
							ensureUnique: true,
							integration: requestState(),
						});
					}

					addVitePlugin(params, {
						warnDuplicated: true,
						plugin: plugin(),
					});
				},
			},
		};
	},
});
