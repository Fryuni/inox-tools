import { defineConfig } from 'astro/config';
import cutShort from '@inox-tools/cut-short';

export default defineConfig({
	devToolbar: { enabled: false },
	integrations: [
		cutShort({
			disableStreaming: true,
		}),
	],
});
