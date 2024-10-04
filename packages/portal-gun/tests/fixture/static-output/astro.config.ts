import { defineConfig } from 'astro/config';
import portalGun from '@inox-tools/portal-gun';

export default defineConfig({
	integrations: [portalGun()],
});
