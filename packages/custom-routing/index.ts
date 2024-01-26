import type {AstroIntegration, APIRoute} from 'astro';

// TODO: Add support for inline API route once Astro core accepts virtual modules
// as injected routes.
type CustomRoute = string; // | APIRoute;

type Options = {
  strict: boolean,
  routes: Record<string, CustomRoute>,
};

function customRoutingInner({strict, routes}, Options): AstroIntegration {
  return {
    name: '@inox-tools/custom-routing',
    hooks: {
      'astro:config:setup': ({injectRoute}) => {
        for (const [route, handle] of Object.entries(routes)) {
          injectRoute({
            entrypoint: handle,
            pattern: route,
          });
        }
      },
      'astro:build:setup': ({pages}) => {
        for (const [route, page] of pages.entries()) {
          console.log({route, page});
        }
      }
    }
  }
}

export function customRouting(routes: Options['routes']): AstroIntegration {
  return customRoutingInner({
    strict: false,
    routes: routes,
  });
}
