import vitePlugin, {
	defineModule,
	inlineModule,
	type ModuleOptions,
} from '@inox-tools/inline-mod/vite';
import type { HookParameters, MiddlewareHandler } from 'astro';
import { definePlugin, type Plugin } from 'astro-integration-kit';
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

type InlineModPlugin = Plugin<
	'inlineModule',
	'astro:config:setup',
	(options: ModuleOptions) => string
>;

export const inlineModPlugin: InlineModPlugin = definePlugin({
	name: 'inlineModule',
	hook: 'astro:config:setup',
	implementation: ({ config, updateConfig }) => {
		const ensurePlugin = ensurePluginIsInstalled({ config, updateConfig });
		return (options: ModuleOptions) => {
			ensurePlugin();
			return inlineModule(options);
		};
	},
});

type DefineModPlugin = Plugin<
	'defineModule',
	'astro:config:setup',
	(name: string, options: ModuleOptions) => void
>;

export const defineModPlugin: DefineModPlugin = definePlugin({
	name: 'defineModule',
	hook: 'astro:config:setup',
	implementation: ({ config, updateConfig, logger }) => {
		const ensurePlugin = ensurePluginIsInstalled({ config, updateConfig });
		return (name: string, options: ModuleOptions) => {
			if (name.startsWith('astro:')) {
				throw new AstroError(
					`${logger.label} is trying to declare a module with a reserved name: ${name}`,
					'The astro: prefix for virtual modules is reserved for Astro core. Please use a different name.'
				);
			}

			ensurePlugin();
			return defineModule(name, options);
		};
	},
});

type DefineMiddlewarePlugin = Plugin<
	'defineMiddleware',
	'astro:config:setup',
	(order: 'pre' | 'post', handler: MiddlewareHandler) => void
>;

export const defineMiddlewarePlugin: DefineMiddlewarePlugin = definePlugin({
	name: 'defineMiddleware',
	hook: 'astro:config:setup',
	implementation: ({ config, updateConfig, addMiddleware }) => {
		const ensurePlugin = ensurePluginIsInstalled({ config, updateConfig });
		return (order: 'pre' | 'post', handler: MiddlewareHandler) => {
			ensurePlugin();
			addMiddleware({
				order,
				entrypoint: inlineModule({
					constExports: {
						onRequest: handler,
					},
				}),
			});
		};
	},
});
