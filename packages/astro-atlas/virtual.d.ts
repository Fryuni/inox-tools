declare module '@it-astro:atlas' {
  import { RouteType, RouteInfo, Segment } from '@inox-tools/astro-atlas/internal/types';

  export { RouteType, RouteInfo, Segment };

  export type CurrentRouteInfo = RouteInfo & {
    params: Record<string, string | undefined>,
  };

  export const currentRoute: CurrentRouteInfo;
}

// Server-side only
declare module '@it-astro:atlas/all' {
  import { RouteInfo } from '@it-astro:atlas';

  export const allRoutes: RouteInfo[];
}
