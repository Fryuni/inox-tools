declare module '@it-astro:cut-short' {
  import type { MaybeThunk } from '@inox-tools/utils/types';

  export const endRequest: (withResponse: MaybeThunk<Response>) => never;
}
