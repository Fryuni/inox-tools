import type { AstroConfig, AstroIntegration as NativeIntegration } from 'astro';
import { definePlugin, type Plugin } from 'astro-integration-kit';
import { AstroError } from 'astro/errors';

export type AstroIntegration = NativeIntegration;

type HookNames = keyof Required<AstroIntegration['hooks']>;

type IntegrationFactory<
	TOptions extends any[],
	TApi extends Record<string, any> = Record<string, never>,
> = (...args: TOptions) => AstroIntegration & TApi;

type AllHookPlugin<TName extends string, TApi> = {
	[Hook in keyof Required<AstroIntegration['hooks']>]: Record<TName, TApi>;
};

export type IntegrationApi<TOptions extends any[], TApi> = {
	/**
	 * Type guard for checking if the integration is an instance of this integration.
	 */
	is(integration: AstroIntegration): integration is AstroIntegration & TApi;

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
	): Plugin<TAttr, AllHookPlugin<TAttr, TApi>>;

	/**
	 * Use this integration API as an optional Astro Integration Kit plugin.
	 *
	 * The API will be available under the given attribute name to all standard Astro hooks.
	 *
	 * If the integration is not already installed, the plugin will provide a null value.
	 */
	asOptionalPlugin<TAttr extends string>(
		attr: TAttr
	): Plugin<TAttr, AllHookPlugin<TAttr, TApi | null>>;
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

/**
 * Expose extra APIs from an integration for other integrations to use.
 *
 * @see NeighborIntegration
 */
export function withApi<
	TOptions extends any[],
	TApi extends Record<string, any> = Record<string, never>,
>(factory: (...args: TOptions) => AstroIntegration & TApi): NeighborIntegration<TOptions, TApi> {
	const integrationSymbol = Symbol(factory.name);

	const wrapper: IntegrationFactory<TOptions, TApi> = (...args) => {
		// Add a marker to the result of the factory so we can find it among all the installed integrations.
		return Object.assign(factory(...args) as any, { [integrationSymbol]: true });
	};

	const api: IntegrationApi<TOptions, TApi> = {
		is: (integration: any): integration is AstroIntegration & TApi =>
			// `integrationSymbol` is a non-exposed unique symbol, so it can only be present where
			// the wrapper function above included it.
			// Therefore an object matching this must be an integration constructed from that.
			integration[integrationSymbol] === true,
		fromIntegrations: (integrations) => integrations.find(api.is) ?? null,
		fromConfig: (config) => api.fromIntegrations(config.integrations),
		asOptionalPlugin: <TAttr extends string>(attr: TAttr) =>
			definePlugin({
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
						'astro:build:setup': () => protectApi('astro:build:setup', attr, pluginApi),
						'astro:build:start': () => protectApi('astro:build:start', attr, pluginApi),
						'astro:build:ssr': () => protectApi('astro:build:ssr', attr, pluginApi),
						'astro:build:done': () => protectApi('astro:build:done', attr, pluginApi),
						'astro:build:generated': () => protectApi('astro:build:generated', attr, pluginApi),
						'astro:server:setup': () => protectApi('astro:server:setup', attr, pluginApi),
						'astro:server:start': () => protectApi('astro:server:start', attr, pluginApi),
						'astro:server:done': () => protectApi('astro:server:done', attr, pluginApi),
					};
				},
			}),
		asPlugin: <TAttr extends string>(attr: TAttr, ...args: TOptions) =>
			definePlugin({
				name: attr,
				setup() {
					const pluginApi = { [attr]: null } as any;

					return {
						'astro:config:setup': ({ config, updateConfig }) => {
							let instance = api.fromConfig(config);

							if (instance === null) {
								// If there is no instance of the integration currently installed, instantiate one
								// using the given options and install it.
								const fullIntegration = wrapper(...args);
								updateConfig({
									integrations: [fullIntegration],
								});

								// Also add the integration to the current configuration in case the API is used
								// twice in the same consumer integration under different names.
								config.integrations.push(fullIntegration);

								// Use the new integration as the API.
								instance = fullIntegration;
							}

							pluginApi[attr] = instance;

							return protectApi('astro:config:setup', attr, pluginApi);
						},
						'astro:config:done': ({ config }) => {
							pluginApi[attr] = api.fromConfig(config);

							return protectApi('astro:config:done', attr, pluginApi);
						},
						'astro:build:setup': () => protectApi('astro:build:setup', attr, pluginApi),
						'astro:build:start': () => protectApi('astro:build:start', attr, pluginApi),
						'astro:build:ssr': () => protectApi('astro:build:ssr', attr, pluginApi),
						'astro:build:done': () => protectApi('astro:build:done', attr, pluginApi),
						'astro:build:generated': () => protectApi('astro:build:generated', attr, pluginApi),
						'astro:server:setup': () => protectApi('astro:server:setup', attr, pluginApi),
						'astro:server:start': () => protectApi('astro:server:start', attr, pluginApi),
						'astro:server:done': () => protectApi('astro:server:done', attr, pluginApi),
					};
				},
			}),
	};

	return Object.assign(wrapper, api);
}