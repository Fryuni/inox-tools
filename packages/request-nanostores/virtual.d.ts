declare module '@it-astro:request-nanostores' {
	import { ReadableAtom } from 'nanostores';

	export const shared: <A extends ReadableAtom<any>>(name: string, store: A) => A;
}
