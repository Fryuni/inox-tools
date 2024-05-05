import { injectContent } from '@inox-tools/content-utils';
import { defineIntegration } from 'astro-integration-kit';

export default defineIntegration({
	name: 'test-integration',
	setup() {
		return {
			hooks: {
				'astro:config:setup': (params) => {
					injectContent(params, {
						entrypoint: './src/integration/config.ts',
					});
				},
			},
		};
	},
});
