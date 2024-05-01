import { addVitePlugin, defineUtility } from "astro-integration-kit";

export const injectContent = defineUtility('astro:config:setup')(
  (params, collectionDefinition) => {
    addVitePlugin()
  }
);
