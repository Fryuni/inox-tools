import { defineConfig } from 'astro/config';
import atlas from '@inox-tools/astro-atlas';

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  integrations: [atlas()],
  output: "server",
  adapter: node({
    mode: "standalone"
  })
});