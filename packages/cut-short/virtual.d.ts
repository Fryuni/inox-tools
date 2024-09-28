declare module '@it-astro:cut-short' {
	import type { MaybeThunk } from '@inox-tools/utils/values';

	export const endRequest: (withResponse: MaybeThunk<Response>) => never;
}
