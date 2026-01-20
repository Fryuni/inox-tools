import { defineConfig } from 'astro/config';
import portalGun from '@inox-tools/portal-gun';

import preact from '@astrojs/preact';

export default defineConfig({
	compressHTML: false,
	integrations: [portalGun(), preact()],
});
