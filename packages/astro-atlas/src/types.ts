import type { RoutePart } from 'astro';

export enum RouteType {
  Page = "Page",
  Endpoint = "Endpoint",

  /**
   * Route type when running on dev server.
   */
  Dev = "Dev", // TODO: Open a PR on Astro so this is not necessary :)

  // TODO: Reconsider whether this should be exposed
  Fallback = "Fallback",
}

export type Segment = RoutePart[];

export type RouteInfo = {
  type: RouteType,
  route: string,
  component: string,
  pattern: RegExp,
  segments: Segment[],
  prerender: boolean,
};
