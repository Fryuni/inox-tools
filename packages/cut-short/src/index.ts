import { defineIntegration, addVitePlugin, createResolver } from 'astro-integration-kit';
import { z } from 'astro/zod';
import { debug } from './internal/debug.js';

export default defineIntegration({
  name: '@inox-tools/cut-short',
  optionsSchema: z.never().optional(),
  setup() {
    const { resolve } = createResolver(import.meta.url);

    return {
      hooks: {
        'astro:config:setup': (params) => {
          params.addMiddleware({
            entrypoint: resolve('./runtime/middleware.js'),
            order: 'post',
          });

          addVitePlugin(params, {
            warnDuplicated: true,
            plugin: {
              name: '@inox-tools/cut-short',
              enforce: 'pre',
              resolveId(source) {
                if (source === '@it-astro:cut-short') {
                  return resolve('./runtime/entrypoint.js');
                }
              },
            },
          });
        },
        'astro:config:done': (params) => {
          // Check if the version of Astro being used has the `injectTypes` utility.
          if (typeof params.injectTypes === 'function') {
            debug('Injecting types in .astro structure');
            params.injectTypes({
              filename: 'types.d.ts',
              content: "import '@inox-tools/cut-short';",
            });
          }
        },
      },
    };
  },
});
