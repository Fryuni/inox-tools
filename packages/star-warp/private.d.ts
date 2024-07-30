namespace Astro {
	interface IntegrationHooks {
		setup: import('@astrojs/starlight/types').StarlightPlugin['hooks']['setup'];
	}
}
