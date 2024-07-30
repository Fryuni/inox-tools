declare module '@it-astro:star-warp:config' {
	const config: {
		env: 'dev' | 'prod';
		trailingSlash: 'ignore' | 'always' | 'never';
	};

	export default config;
}

declare module '@it-astro:star-warp:openSearch' {
	const config: {
		siteName: string;
		description: string;
		searchURL: string;
	};

	export default config;
}
