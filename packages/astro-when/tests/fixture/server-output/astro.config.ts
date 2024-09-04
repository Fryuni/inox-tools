import { defineConfig } from 'astro/config';
import astroWhen from '@inox-tools/astro-when';

export default defineConfig({
  output: 'server',
  integrations: [astroWhen()],
})
