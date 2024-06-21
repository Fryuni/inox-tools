import { injectCollections } from '@inox-tools/content-utils';
import { defineIntegration } from 'astro-integration-kit';

export default defineIntegration({
	name: 'test-integration',
	setup() {
		return {
			hooks: {
				'astro:config:setup': (params) => {
					injectCollections(params, {
						entrypoint: './src/integration/config.ts',
						seedTemplateDirectory: './src/integration',
					});
				},
				'@it-astro:content:gitTrackedListResolved': ({ trackedFiles }) => {
					console.log('Content utils tracking files:', trackedFiles);
				},
				'@it-astro:content:gitCommitResolved': ({ file, age, resolvedDate }) => {
					console.log(
						`Content utils resolved the ${age} commit date for file ${file} as:`,
						resolvedDate
					);
				},
			},
		};
	},
});
