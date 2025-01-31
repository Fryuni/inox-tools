import { defineConfig } from 'astro/config';
import requestState from '@inox-tools/request-state';

export default defineConfig({
	output: 'server',
	integrations: [requestState()],
});
