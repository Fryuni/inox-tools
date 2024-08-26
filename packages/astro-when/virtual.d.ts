declare module '@it-astro:when' {
	export enum When {
		Client = 'client',
		Server = 'server',
		Prerender = 'prerender',
		StaticBuild = 'staticBuild',
		DevServer = 'devServer',
	}

	export const whenAmI: When;

	/**
	 * Returns whether the current context is part of a prerender route.
	 *
	 * On a production build, this value is true for all values during build
	 * and statically false in the resulting server bundle.
	 *
	 * During development, this value depends on the route being processed
	 * and is false for contexts outside of any route, like in top-level
	 * initialization code.
	 */
	export const isPrerenderRoute: () => boolean;
}
