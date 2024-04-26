import { type HookParameters, defineIntegration, addVitePlugin } from "astro-integration-kit";
import { z } from "astro/zod";
import { AstroError } from "astro/errors";
import { RouteType } from './types.js';
import type { RouteData, RouteType as NativeRouteType } from "astro";

type ConfigSetupParams = HookParameters<'astro:config:setup'>;
type BuildSetupParams = HookParameters<'astro:build:setup'>;

export default defineIntegration({
  name: '@inox-tools/astro-atlas',
  optionsSchema: z.record(z.never()).optional(),
  setup({ name }) {
    let allRoutes: RouteData[];

    const virtualModulesFactories: Record<string, {
      resolver?: ((ssr: boolean) => void),
      loader: string | ((ssr: boolean) => string),
    }> = {
      '@it-astro:atlas/all': {
        resolver: (ssr) => {
          if (!ssr) throw new AstroError(
            'Module "@it-astro:atlas/all" cannot be accessed from the client.',
          );
        },
        loader: () => {
          const routesInfo = (allRoutes ?? [])
            .filter(routeData => routeData.type in routeTypeMapping)
            .map(routeData => ({
              type: routeTypeMapping[routeData.type],
              route: routeData.route,
              component: routeData.component,
              pattern: routeData.pattern.source,
              segments: routeData.segments,
              prerender: routeData.prerender,
            }));

          console.log('Serializing route info:', routesInfo);

          return `export const allRoutes = ${JSON.stringify(routesInfo)}
  .map(info => ({...info, pattern: new RegExp(info.pattern)}));`;
        },
      },
      '@it-astro:atlas': {
        loader: ssr => {
          if (ssr) return `
import {currentRoute} from '@inox-tools/astro-atlas/internal/state';
import {RouteType} from '@inox-tools/astro-atlas/internal/types';

export {currentRoute, RouteType};
`;

          // TODO: Implement client-side
          return '';
        }
      }
    };

    return {
      hooks: {
        'astro:config:setup': (params: ConfigSetupParams) => {
          const { addMiddleware } = params;

          addMiddleware({
            entrypoint: '@inox-tools/astro-atlas/internal/middleware',
            order: 'pre',
          });

          addVitePlugin(params, {
            plugin: {
              name,
              resolveId(id, _, { ssr }) {
                if (id in virtualModulesFactories) {
                  const { resolver } = virtualModulesFactories[id];

                  resolver?.(ssr ?? false);

                  return `\x00${id}`;
                }
              },
              load(resolvedId, { ssr } = {}) {
                if (!resolvedId.startsWith('\x00@it-astro:atlas')) return;
                const id = resolvedId.substring(1);
                const { loader } = virtualModulesFactories[id] ?? {};

                if (loader === undefined) {
                  throw new AstroError(
                    'Broken invariant on @inox-tools/astro-atlas.',
                    'Please open an issue on https://github.com/Fryuni/inox-tools/issues/new',
                  );
                }

                if (typeof loader === 'string') return loader;

                return loader(ssr ?? false);
              },
            },
          });
        },
        'astro:build:setup': ({ pages }: BuildSetupParams) => {
          allRoutes = Array.from(pages.values())
            .map(pageData => pageData.route)
        },
      }
    }
  }
});

const routeTypeMapping: Partial<Record<NativeRouteType, RouteType>> = {
  page: RouteType.Page,
  endpoint: RouteType.Endpoint,
  fallback: RouteType.Fallback,
}

