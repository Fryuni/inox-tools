import vitePlugin, {
	defineModule,
	inlineModule,
	type ModuleOptions,
} from '@inox-tools/inline-mod/vite';
import type { HookParameters, MiddlewareHandler } from 'astro';
import { definePlugin } from 'astro-integration-kit';
import { AstroError } from 'astro/errors';
import type { PluginOption } from 'vite';
import debugC from 'debug';

const debug = debugC('inox-tools:aik-mod');

export {
	asyncFactory,
	factory,
	lazyValue,
	type LazyValue,
	type ResolvedLazyValue,
} from '@inox-tools/inline-mod';

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

function ensurePluginIsInstalled(
	options: Pick<HookParameters<'astro:config:setup'>, 'config' | 'updateConfig'>
): () => void {
	const { config, updateConfig } = options;
	if (hasPlugin(config.vite?.plugins || [], '@inox-tools/inline-mod')) {
		debug('Plugin is already installed, using no-op installation function.');
		return () => {};
	}

	let done = false;

	return () => {
		if (done) {
			debug('Reusing installed plugin');
			return;
		}
		debug('Installing inline-mod plugin');
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
			'astro:config:setup': (params) => {
				const { config, addMiddleware, updateConfig, logger } = params;

				const ensurePlugin = ensurePluginIsInstalled({ config, updateConfig });

				return {
					inlineModule: (options: ModuleOptions) => {
						ensurePlugin();
						debug('Inlining module');
						const moduleId = inlineModule(options);
						debug(`Module inlined as ${moduleId}`);
						return moduleId;
					},
					defineModule: (name: string, options: ModuleOptions) => {
						if (name.startsWith('astro:')) {
							throw new AstroError(
								`${logger.label} is trying to declare a module with a reserved name: ${name}`,
								'The astro: prefix for virtual modules is reserved for Astro core. Please use a different name.'
							);
						}

						ensurePlugin();
						debug(`Defining module: ${name}`);
						return defineModule(name, options);
					},
					defineMiddleware: (order: 'pre' | 'post', handler: MiddlewareHandler) => {
						ensurePlugin();
						const moduleId = inlineModule({
							constExports: {
								onRequest: handler,
							},
						});
						debug(`Defining ${order} middleware as ${moduleId}`);
						addMiddleware({
							order,
							entrypoint: moduleId,
						});
					},
				};
			},
		};
	},
});
