import {
	defineIntegration,
	hasIntegration,
	addIntegration,
	addVitePlugin,
} from 'astro-integration-kit';
import { plugin } from './plugin.js';
import requestState from '@inox-tools/request-state';
import { z } from 'astro/zod';

export default defineIntegration({
	name: '@inox-tools/request-nanostores',
	setup() {
		return {
			hooks: {
				'astro:config:setup': (params) => {
					if (!hasIntegration(params, { name: '@inox-tools/request-state' })) {
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
