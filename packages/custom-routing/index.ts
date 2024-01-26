import type { AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import { fileURLToPath } from 'node:url';
import { resolve, sep as PATH_SEP } from 'node:path';

// TODO: Add support for inline API route once Astro core accepts virtual modules
// as injected routes.
type CustomRoute = string; // | APIRoute;

type Options = {
  strict: boolean,
  routes: Record<string, CustomRoute>,
};

function customRoutingInner({ strict, routes }: Options): AstroIntegration {
  return {
    name: '@inox-tools/custom-routing',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const [route, handle] of Object.entries(routes)) {
          injectRoute({
            entrypoint: handle,
            pattern: route,
          });
        }
      },
      ...(strict && {
        'astro:build:setup': ({ vite, pages }) => {
          const pagesFolder = resolve(vite.root ?? '', './src/pages') + PATH_SEP;
          for (const page of pages.values()) {
            const componentPath = resolve(vite.root ?? '', page.component);
            if (componentPath.startsWith(pagesFolder)) {
              throw new AstroError(
                'Custom routing used alongside pages route.',
                'Either use disable strict mode of custom routing or remove any file-based routes.'
              );
            }
          }
        }
      }),
    }
  };
}

export function customRouting(routes: Options['routes']): AstroIntegration {
  return customRoutingInner({
    strict: false,
    routes: routes,
  });
}

export function strictCustomRouting(routes: Options['routes']): AstroIntegration {
  return customRoutingInner({
    strict: true,
    routes: routes,
  });
}
