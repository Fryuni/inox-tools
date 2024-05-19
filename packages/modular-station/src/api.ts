import type { AstroConfig, AstroIntegration as NativeIntegration } from 'astro';
import { defineIntegration as aikDefiner, definePlugin, type Plugin } from 'astro-integration-kit';
import { z } from 'astro/zod';

export type AstroIntegration = NativeIntegration;

export type IntegrationSetupFn<
	Options extends z.ZodTypeAny,
	TApi extends Record<Exclude<string, 'hooks'>, any> = Record<string, never>,
> = (params: { name: string; options: z.output<Options> }) => Omit<AstroIntegration, 'name'> & TApi;

type IntegrationOptions<TOptionsSchema extends z.ZodTypeAny> = [z.input<TOptionsSchema>] extends [
	never,
]
	? []
	: undefined extends z.input<TOptionsSchema>
		? [options?: z.input<TOptionsSchema>]
		: [options: z.input<TOptionsSchema>];

export type IntegrationFactory<
	TOptionsSchema extends z.ZodTypeAny,
	TApi extends Record<string, any> = Record<string, never>,
> = (...args: IntegrationOptions<TOptionsSchema>) => AstroIntegration & TApi;

type AllHookPlugin<TName extends string, TApi> = {
	[Hook in keyof Required<AstroIntegration['hooks']>]: Record<TName, TApi>;
};

export type IntegrationApi<TName extends string, TOptionsSchema extends z.ZodTypeAny, TApi> = {
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
		...args: IntegrationOptions<TOptionsSchema>
	): Plugin<TName, AllHookPlugin<TAttr, TApi>>;

	/**
	 * Use this integration API as an optional Astro Integration Kit plugin.
	 *
	 * The API will be available under the given attribute name to all standard Astro hooks.
	 *
	 * If the integration is not already installed, the plugin will provide a null value.
	 */
	asOptionalPlugin<TAttr extends string>(
		attr: TAttr
	): Plugin<TName, AllHookPlugin<TAttr, TApi | null>>;
};

export type NeighborIntegration<
	TName extends string,
	TOptionsSchema extends z.ZodTypeAny = z.ZodNever,
	TApi extends Record<string, any> = Record<string, never>,
> = IntegrationFactory<TOptionsSchema, TApi> & IntegrationApi<TName, TOptionsSchema, TApi>;

// Source: https://www.totaltypescript.com/concepts/the-prettify-helper
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/**
 * Define an Astro Integration with extra APIs for other peer integrations.
 *
 * @see NeighborIntegration
 */
export function defineIntegration<
	TName extends string,
	TOptionsSchema extends z.ZodTypeAny = z.ZodNever,
	TApi extends Record<string, any> = Record<string, never>,
>(params: {
	name: TName;
	optionsSchema?: TOptionsSchema;
	setup: IntegrationSetupFn<TOptionsSchema, TApi>;
}): NeighborIntegration<TName, TOptionsSchema, Prettify<Omit<TApi, keyof AstroIntegration>>> {
	const factory = aikDefiner(params);

	const integrationSymbol = Symbol(params.name);

	const wrapper: IntegrationFactory<TOptionsSchema, TApi> = (...args) => {
		return Object.assign(factory(...args) as any, { [integrationSymbol]: true });
	};

	const api: IntegrationApi<TName, TOptionsSchema, TApi> = {
		is: (integration: any): integration is AstroIntegration & TApi =>
			integration[integrationSymbol] === true,
		fromIntegrations: (integrations) => integrations.find(api.is) ?? null,
		fromConfig: (config) => api.fromIntegrations(config.integrations),
		asOptionalPlugin: <TAttr extends string>(attr: TAttr) =>
			definePlugin({
				name: params.name,
				setup() {
					const pluginApi = { [attr]: null } as any;

					return {
						'astro:config:setup': ({ config }) => {
							pluginApi[attr] = api.fromConfig(config);

							return pluginApi;
						},
						'astro:config:done': ({ config }) => {
							pluginApi[attr] = api.fromConfig(config);

							return pluginApi;
						},
						'astro:build:setup': () => pluginApi,
						'astro:build:start': () => pluginApi,
						'astro:build:ssr': () => pluginApi,
						'astro:build:done': () => pluginApi,
						'astro:build:generated': () => pluginApi,
						'astro:server:setup': () => pluginApi,
						'astro:server:start': () => pluginApi,
						'astro:server:done': () => pluginApi,
					};
				},
			}),
		asPlugin: <TAttr extends string>(attr: TAttr, ...args: IntegrationOptions<TOptionsSchema>) =>
			definePlugin({
				name: params.name,
				setup() {
					const pluginApi = { [attr]: null } as any;

					return {
						'astro:config:setup': ({ config, updateConfig }) => {
							let instance = api.fromConfig(config);
							if (instance === null) {
								instance = wrapper(...args);
								updateConfig({
									integrations: [instance],
								});
							}

							pluginApi[attr] = instance;

							return pluginApi;
						},
						'astro:config:done': ({ config }) => {
							pluginApi[attr] = api.fromConfig(config);

							return pluginApi;
						},
						'astro:build:setup': () => pluginApi,
						'astro:build:start': () => pluginApi,
						'astro:build:ssr': () => pluginApi,
						'astro:build:done': () => pluginApi,
						'astro:build:generated': () => pluginApi,
						'astro:server:setup': () => pluginApi,
						'astro:server:start': () => pluginApi,
						'astro:server:done': () => pluginApi,
					};
				},
			}),
	};

	return Object.assign(wrapper, api);
}
