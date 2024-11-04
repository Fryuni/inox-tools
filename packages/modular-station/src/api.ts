import type { AstroConfig, HookParameters, AstroIntegration as NativeIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import {
	DEFAULT_HOOK_FACTORY,
	allHooksPlugin,
	type AllHooksPlugin,
	type HookNames,
} from './allHooksPlugin.js';
import type { Prettify } from '@inox-tools/utils/types';
import { getDebug } from './internal/debug.js';

const debug = getDebug('api');

export type AstroIntegration = NativeIntegration;

type IntegrationFactory<
	TOptions extends any[],
	TApi extends Record<string, any> = Record<string, never>,
> = (...args: TOptions) => AstroIntegration & TApi;

export type IntegrationFromSetup = Pick<
	HookParameters<'astro:config:setup'>,
	'config' | 'updateConfig'
>;

export type IntegrationApi<TOptions extends any[], TApi> = {
	/**
	 * Type guard for checking if the integration is an instance of this integration.
	 */
	is(integration: AstroIntegration): integration is AstroIntegration & TApi;

	/**
	 * Extracts the integration with it's API from a reduced integration processed by Astro's
	 * validation phase.
	 */
	fromIntegration(integration: AstroIntegration): (AstroIntegration & TApi) | null;

	/**
	 * Get the instance of this integration API from the Astro config in the `astro:config:setup` hook.
	 *
	 * Automatically installs the integration if it is not already installed.
	 */
	fromSetup(params: IntegrationFromSetup, ...args: TOptions): TApi;

	/**
	 * Get the instance of this integration API from the Astro config.
	 *
	 * Returns `null` if the integration is not installed.
	 */
	fromConfig(config: AstroConfig): TApi | null;

	/**
	 * Get the instance of this integration API from the list of installed integrations.
	 */
	fromIntegrations(integrations: AstroIntegration[]): TApi | null;

	/**
	 * Use this integration API as an Astro Integration Kit plugin.
	 *
	 * The API will be available under the given attribute name to all standard Astro hooks.
	 *
	 * If the integration is not already installed, it will be installed using the given options.
	 */
	asPlugin<TAttr extends string>(
		attr: TAttr,
		...args: TOptions
	): AllHooksPlugin<TAttr, Record<TAttr, TApi>>;

	/**
	 * Use this integration API as an optional Astro Integration Kit plugin.
	 *
	 * The API will be available under the given attribute name to all standard Astro hooks.
	 *
	 * If the integration is not already installed, the plugin will provide a null value.
	 */
	asOptionalPlugin<TAttr extends string>(
		attr: TAttr
	): AllHooksPlugin<TAttr, Record<TAttr, TApi | null>>;
};

/**
 * An integration that exposes APIs for peer integrations to use.
 */
export type NeighborIntegration<
	TOptions extends any[],
	TApi extends Record<string, any> = Record<string, never>,
> = IntegrationFactory<TOptions, TApi> & IntegrationApi<TOptions, TApi>;

const TARGET_HOOKS = Symbol('@inox-tools/modular-station:targetHooks');

/**
 * An API restricted to some hooks.
 *
 * Accessing this API from any other hooks will fail at runtime.
 */
export type HookLimitedApi<THook, TApi> = TApi & {
	[TARGET_HOOKS]: THook[];
};

function isHookLimited(api: object): api is HookLimitedApi<HookNames, object> {
	return TARGET_HOOKS in api;
}

/**
 * Specify on which hooks this API may be called.
 */
export function onHook<THook extends HookNames, TApi extends object>(
	hooks: THook | THook[],
	api: TApi
): HookLimitedApi<THook, TApi> {
	return Object.assign(api, {
		[TARGET_HOOKS]: typeof hooks === 'string' ? [hooks] : hooks,
	});
}

function protectApi<TAttr extends string, TApi extends Record<string, any>>(
	currentHook: HookNames,
	attr: TAttr,
	api: TApi
): Record<TAttr, TApi> {
	return {
		[attr]: new Proxy(api, {
			get(target, prop, receiver) {
				const val: unknown = Reflect.get(target, prop, receiver);

				if (typeof val !== 'object' || val === null) return val;

				const allowedHooks: HookNames[] = isHookLimited(val)
					? val[TARGET_HOOKS]
					: ['astro:config:setup'];

				if (!allowedHooks.includes(currentHook)) {
					throw new AstroError(
						`API \`${attr}.${prop.toString()}\` is not available on hook "${currentHook}".`
					);
				}

				return val;
			},
		}),
	} as Record<TAttr, TApi>;
}

const API_RECOVER_HOOK_MARKER = `@it:modular-station:internal:${crypto.randomUUID()}`;

/**
 * Expose extra APIs from an integration for other integrations to use.
 *
 * @see NeighborIntegration
 */
export function withApi<
	TOptions extends any[],
	TApi extends Record<string, any> = Record<string, never>,
>(
	factory: (...args: TOptions) => AstroIntegration & TApi
): NeighborIntegration<TOptions, Prettify<Omit<TApi, 'hooks'>>> {
	const integrationSymbol = Symbol(factory.name || crypto.randomUUID());
	debug(`Generated new integration symbol:`, integrationSymbol);

	const wrapper: IntegrationFactory<TOptions, TApi> = (...args) => {
		const integration = factory(...args) as any;
		debug('Associating integration symbol with factory:', { integrationSymbol, integration });

		// Extra APIs in an integration are removed when processed by the Zod validator when it comes from the user config
		// but ONLY when coming from the user config, so APIs are allowed between transitive integrations but not between
		// two direct integrations nor between a direct and a transitive integration.
		// Extra hooks, so long as they are not symbolic, are passed through tho, so, to circumvent this, we add
		// a randomly generated hook returning the original value along with the symbolic marker. The hook name
		// is randomly generated at runtime to avoid it being used by people that mess with internals of things (like we are doing here).
		// The return value includes the symbolic marker to allow detecting whether the integration is the intended one
		// even across duplicated installations, while the integration object is returned to recover access
		// to the complete API after it is deleted by Astro.
		Object.assign(integration.hooks, {
			[API_RECOVER_HOOK_MARKER]: () => ({ integrationSymbol, integration }),
		});
		debug('Associated integration symbol with factory:', integration);
		return integration;
	};

	const api: IntegrationApi<TOptions, TApi> = {
		is: (integration: any): integration is AstroIntegration & TApi => {
			debug('Checking integration for symbol', { integrationSymbol, integration });
			const recovered = integration?.hooks?.[API_RECOVER_HOOK_MARKER]?.();

			// `integrationSymbol` is a non-exposed unique symbol, so it can only be present where
			// the wrapper function above included it.
			// Therefore an object matching this must be an integration constructed from the wrapper.
			return recovered?.integrationSymbol === integrationSymbol;
		},
		fromIntegration: (integration: AstroIntegration): (AstroIntegration & TApi) | null => {
			debug('Checking integration for symbol', { integrationSymbol, integration });
			const recovered = (integration.hooks as any)[API_RECOVER_HOOK_MARKER]?.();

			return recovered?.integrationSymbol === integrationSymbol ? recovered.integration : null;
		},
		fromIntegrations: (integrations) => {
			for (const integration of integrations) {
				const target = api.fromIntegration(integration);
				if (target !== null) return target;
			}

			return null;
		},
		fromConfig: (config) => api.fromIntegrations(config.integrations),
		fromSetup: ({ config }, ...args) => {
			let instance = api.fromConfig(config);

			if (instance === null) {
				// If there is no instance of the integration currently installed, instantiate one
				// using the given options and install it.
				const fullIntegration = wrapper(...args);
				debug(`Could not find integration "${fullIntegration.name}" in the config. Installing it.`);
				config.integrations.push(fullIntegration);

				// Use the new integration as the API.
				instance = fullIntegration;
			}

			return instance;
		},
		asOptionalPlugin: <TAttr extends string>(attr: TAttr) =>
			allHooksPlugin({
				name: attr,
				setup() {
					const pluginApi: any = null;

					return {
						'astro:config:setup': ({ config }) => {
							pluginApi[attr] = api.fromConfig(config);

							return protectApi('astro:config:setup', attr, pluginApi);
						},
						'astro:config:done': ({ config }) => {
							pluginApi[attr] = api.fromConfig(config);

							return protectApi('astro:config:done', attr, pluginApi);
						},
						[DEFAULT_HOOK_FACTORY]: (hookName) => {
							if (pluginApi === null) {
								throw new AstroError(
									`API ${attr} is not available on hook ${hookName} because it is being executed before "astro:config:setup".`
								);
							}

							return () => protectApi(hookName, attr, pluginApi);
						},
					};
				},
			}),
		asPlugin: <TAttr extends string>(attr: TAttr, ...args: TOptions) =>
			allHooksPlugin({
				name: attr,
				setup() {
					const pluginApi = { [attr]: null } as any;

					return {
						'astro:config:setup': (params) => {
							pluginApi[attr] = api.fromSetup(params, ...args);

							return protectApi('astro:config:setup', attr, pluginApi);
						},
						'astro:config:done': ({ config }) => {
							pluginApi[attr] = api.fromConfig(config);

							return protectApi('astro:config:done', attr, pluginApi);
						},
						[DEFAULT_HOOK_FACTORY]: (hookName) => () => protectApi(hookName, attr, pluginApi),
					};
				},
			}),
	};

	return Object.assign(wrapper, api);
}
