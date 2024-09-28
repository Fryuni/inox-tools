import { defineConfig } from 'astro/config';
import requestNanostores from '@inox-tools/request-nanostores';

export default defineConfig({
	output: 'server',
	integrations: [requestNanostores()],
	devToolbar: { enabled: false },
});
