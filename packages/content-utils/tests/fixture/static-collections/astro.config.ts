import { defineConfig } from 'astro/config';
import contentUtils from '@inox-tools/content-utils';

export default defineConfig({
	integrations: [
		contentUtils({
			staticOnlyCollections: ['static-only'],
		}),
	],
});
