declare module '@it-astro:when' {
	export enum When {
		Client = 'client',
		Server = 'server',
		Prerender = 'prerender',
		StaticBuild = 'staticBuild',
		DevServer = 'devServer',
	}

	export const whenAmI: When;
}
