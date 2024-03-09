declare module 'sitemap-ext:config' {
	type ConfigCallback = (hooks: {
		addToSitemap: (routeParams?: Record<string, string | undefined>[]) => void;
		removeFromSitemap: (routeParams?: Record<string, string | undefined>[]) => void;
		setSitemap: (
			routeParams: Array<{ sitemap?: boolean; params: Record<string, string | undefined> }>
		) => void;
	}) => Promise<void> | void;

	declare const sitemap: (option: ConfigCallback | boolean) => void;

	export default sitemap;
}
