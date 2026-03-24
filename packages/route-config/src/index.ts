import { hoistGlobalPlugin } from './hoistGlobalPlugin.js';
import { integrate, convertContext } from './contextResolution.js';
import type { ConfigContext, InnerContext } from './contextResolution.js';
import { debug } from './debug.js';
import type { HookParameters } from 'astro';

type ConfigHandler<T> = (context: ConfigContext, value: T) => Promise<void> | void;

type InnerHandler<T> = (context: InnerContext, value: T) => Promise<void>;

type PerRouteConfigOptions<T> = {
	importName: string;
	callbackHandler: ConfigHandler<T>;
};

const GLOBAL_HANDLERS_SYMBOL = Symbol.for('@inox-tools/route-config');

const globalHandlers: Map<string, InnerHandler<any>> = ((globalThis as any)[
	GLOBAL_HANDLERS_SYMBOL
] ??= new Map());

export function defineRouteConfig<T = any>(
	params: Pick<HookParameters<'astro:config:setup'>, 'logger' | 'command' | 'updateConfig'>,
	options: PerRouteConfigOptions<T>
): void {
	integrate(params);

	const innerHandler: InnerHandler<T> = async (context, value) => {
		// Do nothing while running dev or preview server
		if (params.command !== 'build') return;

		debug(`Loading route config from ${context.sourceFile} from ${options.importName}`);

		const outerContext = convertContext(context);
		if (outerContext) {
			await options.callbackHandler(outerContext, value);
		} else {
			params.logger.warn(
				`Trying to set a route config for a file that is not a page: ${context.sourceFile}`
			);
		}
	};

	globalHandlers.set(options.importName, innerHandler);

	params.updateConfig({
		vite: {
			plugins: [
				hoistGlobalPlugin({
					configImport: options.importName,
					logger: params.logger,
				}),
			],
		},
	});
}
