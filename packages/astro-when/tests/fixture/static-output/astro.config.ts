import { defineConfig } from 'astro/config';
import astroWhen from '@inox-tools/astro-when';

export default defineConfig({
  integrations: [astroWhen()],
})
