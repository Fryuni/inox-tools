import { defineConfig } from 'astro/config';
import cutShort from '@inox-tools/cut-short';

export default defineConfig({
	integrations: [cutShort()],
});
