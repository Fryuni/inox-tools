declare module '@it-astro:star-warp:config' {
	const config: {
		env: 'dev' | 'prod';
		trailingSlash: 'ignore' | 'always' | 'never';
	};

	export default config;
}
