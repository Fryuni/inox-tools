import type { Plugin } from 'vite';
import { getDebug } from './debug.js';
import { inspect } from 'node:util';

const VIRTUAL_MODULE_ID = '@it-astro:when';
const RESOLVED_MODULE_ID = `\x00${VIRTUAL_MODULE_ID}`;

const debug = getDebug('vite-plugin');

// Globally indicate to the virtual module that it is in the same context as the build system.
export const BUILD_CONTEXT_KEY = Symbol.for('astro:when/buildContext');

type Options = {
  command: 'dev' | 'build' | 'preview' | 'sync';
  outputMode: 'static' | 'hybrid' | 'server';
  pagesPath: string;
  routeComponents: Set<string>;
};

export const plugin = (opt: Options): Plugin => {
  console.log(opt);

  return {
    name: '@inox-tools/astro-when',
    enforce: 'post',
    async resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        debug('Resolving virtual module ID');
        return RESOLVED_MODULE_ID;
      }
    },
    load(id, options) {
      if (id !== RESOLVED_MODULE_ID) return;

      return `
        export const When = {
          Client: 'client',
          Server: 'server',
          Prerender: 'prerender',
          StaticBuild: 'staticBuild',
          DevServer: 'devServer',
        };

        ${getWhenAmIConstantCode(opt, options?.ssr)}
      `;
    },
    transform(_, id) {
      const [cleanedId] = id.split('?', 1);

      if (opt.routeComponents.has(cleanedId)) {
        const modInfo = this.getModuleInfo(id);
        if (!modInfo) return;

        console.log(
          inspect(
            {
              id,
              meta: modInfo.meta,
            },
            { depth: null }
          )
        );
      }
    },
  };
};

function getWhenAmIConstantCode(options: Options, ssr?: boolean): string {
  const { command, outputMode } = options;

  if (ssr !== true) {
    debug('Generating module for client');
    return 'export const whenAmI = When.Client;';
  }

  if (command === 'dev') {
    debug('Generating module for dev server');
    return 'export const whenAmI = When.DevServer;';
  }

  if (outputMode === 'static') {
    debug('Generating module for static build');
    return 'export const whenAmI = When.StaticBuild;';
  }

  debug('Generating module for live server');
  return (
    "const isBuildContext = Symbol.for('astro:when/buildContext');" +
    'export const whenAmI = globalThis[isBuildContext] ? When.Prerender : When.Server;'
  );
}
