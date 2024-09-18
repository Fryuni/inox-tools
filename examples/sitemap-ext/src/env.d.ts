/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module '@it-astro:cut-short' {
  export const endRequest: (withResponse: Response | (() => Promise<Respone> | Response)) => never;
}
