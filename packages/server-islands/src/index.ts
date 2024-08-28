import { addVitePlugin, createResolver, defineIntegration } from 'astro-integration-kit';
import { debug } from './runtime/debug.js';

const MODULE_ID = '@it-astro:server-islands';
const RESOLVED_MODULE_ID = `\x00${MODULE_ID}`;

export default defineIntegration({
  name: '@inox-tools/server-islands',
  setup() {
    const { resolve } = createResolver(import.meta.url);

    return {
      hooks: {
        'astro:config:setup': (params) => {
          addVitePlugin(params, {
            plugin: {
              name: '@inox-tools/server-islands',
              resolveId(id) {
                if (id === MODULE_ID) return RESOLVED_MODULE_ID;
              },
              load(id) {
                if (id !== RESOLVED_MODULE_ID) return;

                debug('Virtual module loaded');
                const runtime = resolve('./runtime/lib.js');
                return `export * from '${runtime}';`;
              },
            },
          });
        },
      },
    };
  },
});
