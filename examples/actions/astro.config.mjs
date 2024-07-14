import { defineConfig } from "astro/config";
import simpleScope from "vite-plugin-simple-scope";
import icon from "astro-icon";
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  output: "hybrid",
  adapter: netlify(),
  integrations: [icon(), react()],
  vite: {
    plugins: [simpleScope()],
    // Preserve web component names during builds
    esbuild: {
      keepNames: true,
    },
  },
  experimental: {
    actions: true,
  },
});
