import type { CurrentRouteInfo } from "@it-astro:atlas";
import { AstroError } from "astro/errors";
import { AsyncLocalStorage } from "node:async_hooks";

// TODO: Make this work on Cloudflare
export const state = new AsyncLocalStorage<CurrentRouteInfo>();

function getRoute(): CurrentRouteInfo {
  const route = state.getStore();

  if (route === undefined) {
    throw new AstroError(`"currentRoute" accessed outside of any route execution.`);
  }

  return route;
}

export const currentRoute = new Proxy<CurrentRouteInfo>({} as CurrentRouteInfo, {
  get: (_, prop) => {
    const route = getRoute();
    return Reflect.get(route, prop, route);
  },
  set: () => {
    throw new AstroError('Cannot set properties on "currentRoute"');
  },
  has: (_, prop) => {
    const route = getRoute();
    return Reflect.has(route, prop);
  },
  ownKeys: () => {
    const route = getRoute();
    return Reflect.ownKeys(route);
  },
  getOwnPropertyDescriptor: (_, prop) => {
    const route = getRoute();
    return Reflect.getOwnPropertyDescriptor(route, prop);
  }
});
