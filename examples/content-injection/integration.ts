import { injectCollections } from '@inox-tools/content-utils';
import { runtimeLogger } from '@inox-tools/runtime-logger';
import { defineIntegration } from 'astro-integration-kit';
import { inspect } from 'node:util';

export default defineIntegration({
	name: 'test-integration',
	setup() {
		return {
			hooks: {
				'astro:config:setup': (params) => {
					runtimeLogger(params, {
						name: 'test-integration',
					});
					injectCollections(params, {
						entrypoint: './src/integration/config.ts',
						seedTemplateDirectory: './src/integration',
					});
				},
				'@it/content:git:listed': ({ trackedFiles, logger }) => {
					logger.info('Content utils tracking files: ' + trackedFiles);
				},
				'@it/content:git:resolved': ({ file, fileInfo, logger }) => {
					logger.warn(
						`Content utils resolved the commit info for file ${file} as: ${inspect(fileInfo, { depth: null })}`
					);
				},
			},
		};
	},
});
