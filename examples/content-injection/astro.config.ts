import { defineConfig } from 'astro/config';
import integration from './integration';
import runtimeLogger from '@inox-tools/runtime-logger';
import contentUtils from '@inox-tools/content-utils';

const ignoreBefore = Date.parse('2024-08-01') / 1000;

// https://astro.build/config
export default defineConfig({
	integrations: [
		runtimeLogger(),
		contentUtils({
			onCommit: ({ commitInfo, drop }) => {
				if (commitInfo.secondsSinceEpoch < ignoreBefore) {
					drop();
				}
			},
		}),
		integration(),
	],
});
