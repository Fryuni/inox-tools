declare namespace ITAstroPortalGun {
	interface NewElements {
		'portal-gate': { to: string; children: any };
		'portal-landzone': { name: string; children: any };
	}
}

import 'astro/astro-jsx';

declare module 'astro/astro-jsx' {
	export namespace astroHTML {
		export namespace JSX {
			export interface IntrinsicElements extends ITAstroPortalGun.NewElements { }
		}
	}
}

declare global {
	namespace JSX {
		export interface IntrinsicElements extends ITAstroPortalGun.NewElements { }
	}

	namespace preact.JSX {
		interface IntrinsicElements extends ITAstroPortalGun.NewElements { }
	}

	namespace svelteHTML {
		interface IntrinsicElements extends ITAstroPortalGun.NewElements { }
	}
}

declare module 'solid-js' {
	namespace JSX {
		interface IntrinsicElements extends ITAstroPortalGun.NewElements { }
	}
}
