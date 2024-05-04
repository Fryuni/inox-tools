import { addVitePlugin, defineUtility } from "astro-integration-kit";

export type Options = {
  entrypoint: string,
};

export const injectContent = defineUtility('astro:config:setup')(
  (params, options: Options) => {
    addVitePlugin(params, {
      plugin: {
        name: '',
      },
    });
  }
);
