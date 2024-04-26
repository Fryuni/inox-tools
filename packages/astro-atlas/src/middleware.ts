import { defineMiddleware } from "astro/middleware";
import { allRoutes } from '@it-astro:atlas/all';
import { state } from './state.js';
import { RouteType, type CurrentRouteInfo } from "@it-astro:atlas";

export const onRequest = defineMiddleware((ctx, next) => {
  const { pathname } = ctx.url;

  for (const route of allRoutes) {
    if (route.pattern.test(pathname)) {
      // TODO: Send the information to the client as well

      const requestRoute: CurrentRouteInfo = {
        ...route,
        params: ctx.params,
      };

      return state.run(requestRoute, next);
    }
  }

  const placeholderRoute: CurrentRouteInfo = {
    type: RouteType.Dev,
    route: pathname,
    pattern: new RegExp(`^${pathname}$`),
    segments: pathname.split('/')
      .filter(segment => !!segment)
      .map(segment => [{
        content: segment,
        dynamic: false,
        spread: false,
      }]),
    params: ctx.params,
    component: 'unknown',
    prerender: false,
  };

  return state.run(placeholderRoute, next);
});
