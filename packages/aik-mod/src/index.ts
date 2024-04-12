import vitePlugin, {
	defineModule,
	inlineModule,
	type ModuleOptions,
} from '@inox-tools/inline-mod/vite';
import type { HookParameters, MiddlewareHandler } from 'astro';
import { definePlugin } from 'astro-integration-kit';
import { AstroError } from 'astro/errors';
import type { PluginOption } from 'vite';

export { asyncFactory, factory } from '@inox-tools/inline-mod';

type HookParams = HookParameters<'astro:config:setup'>;

process.setSourceMapsEnabled(true);

function hasPlugin(pluginList: PluginOption[], pluginName: string): boolean {
	return pluginList.some((plugin) => {
		if (!plugin) return false;

		if (Array.isArray(plugin)) {
			return hasPlugin(plugin, pluginName);
		}

		if (plugin instanceof Promise) {
			// Ignore async plugin construction
			return false;
		}

		return plugin.name === pluginName;
	});
}

function ensurePluginIsInstalled(options: Pick<HookParams, 'config' | 'updateConfig'>): () => void {
	const { config, updateConfig } = options;
	if (hasPlugin(config.vite?.plugins || [], '@inox-tools/inline-mod')) {
		return () => {};
	}

	let done = false;

	return () => {
		if (done) return;
		done = true;
		updateConfig({
			vite: {
				plugins: [vitePlugin()],
			},
		});
	};
}

export default definePlugin({
	name: '@inox-tools/aik-mod',
	setup: () => {
		return {
			'astro:config:setup': ({ config, addMiddleware, updateConfig, logger }) => {
				const ensurePlugin = ensurePluginIsInstalled({ config, updateConfig });

				return {
					inlineModule: (options: ModuleOptions) => {
						ensurePlugin();
						return inlineModule(options);
					},
					defineModule: (name: string, options: ModuleOptions) => {
						if (name.startsWith('astro:')) {
							throw new AstroError(
								`${logger.label} is trying to declare a module with a reserved name: ${name}`,
								'The astro: prefix for virtual modules is reserved for Astro core. Please use a different name.'
							);
						}

						ensurePlugin();
						return defineModule(name, options);
					},
					defineMiddleware: (order: 'pre' | 'post', handler: MiddlewareHandler) => {
						ensurePlugin();
						addMiddleware({
							order,
							entrypoint: inlineModule({
								constExports: {
									onRequest: handler,
								},
							}),
						});
					},
				};
			},
		};
	},
});
