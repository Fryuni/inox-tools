import { definePlugin } from 'astro-integration-kit';
import { addVitePlugin } from 'astro-integration-kit/utilities';
import { hoistGlobalPlugin } from './hoistGlobalPlugin.js';
import { integrate, convertContext } from './contextResolution.js';
import type { ConfigContext, InnerContext } from './contextResolution.js';

type ConfigHandler<T> = (context: ConfigContext, value: T) => Promise<void> | void;

type InnerHandler<T> = (context: InnerContext, value: T) => Promise<void>;

type PerRouteConfigOptions<T> = {
	importName: string;
	callbackHandler: ConfigHandler<T>;
};

const GLOBAL_HANDLERS_SYMBOL = Symbol.for('@inox-tools/aik-route-config');

const globalHandlers: Map<string, InnerHandler<any>> = ((globalThis as any)[
	GLOBAL_HANDLERS_SYMBOL
] ??= new Map());

export default definePlugin({
	name: 'defineRouteConfig',
	hook: 'astro:config:setup',
	implementation: (astroConfig) => {
		const { logger, updateConfig, command } = astroConfig;

		return <T = any>(options: PerRouteConfigOptions<T>): void => {
			integrate(astroConfig);

			const innerHandler: InnerHandler<T> = async (context, value) => {
				// Do nothing while running dev or preview server
				if (command !== 'build') return;

				const outerContext = convertContext(context);
				if (outerContext) {
					await options.callbackHandler(outerContext, value);
				} else {
					logger.warn(
						`Trying to set a route config for a file that is not a page: ${context.sourceFile}`
					);
				}
			};

			globalHandlers.set(options.importName, innerHandler);

			addVitePlugin({
				plugin: hoistGlobalPlugin({
					configImport: options.importName,
					logger,
				}),
				updateConfig,
			});
		};
	},
});
