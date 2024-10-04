type PortalAttrs = { children?: any } & ({ to: string; name: never } | { name: string; to: never });

interface NewElements {
	portal: PortalAttrs;
}

declare namespace JSX {
	export interface IntrinsicElements extends NewElements {}
}

import 'preact';

declare module 'preact' {
	export namespace JSX {
		export interface IntrinsicElements extends NewElements {}
	}
}

import 'astro/astro-jsx';

declare module 'astro/astro-jsx' {
	export namespace astroHTML {
		export namespace JSX {
			export interface IntrinsicElements extends NewElements {}
		}
	}
}
