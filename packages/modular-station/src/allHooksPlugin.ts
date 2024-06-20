import { definePlugin, type Plugin, type Hooks } from 'astro-integration-kit';

export const DEFAULT_HOOK_FACTORY: unique symbol = Symbol(
	'@inox-tools/modular-station:allHooksPlugin/default'
);

export type HookNames = keyof Hooks;

export type PluginSetup<TApi extends Record<string, unknown>> = {
	[Hook in keyof Hooks]?: (...params: Parameters<Hooks[Hook]>) => TApi;
} & {
	[DEFAULT_HOOK_FACTORY]: <H extends keyof Hooks>(
		name: H
	) => (...params: Parameters<Hooks[H]>) => TApi;
};

export type AllHooksPluginDefinition<TName extends string, TApi extends Record<string, unknown>> = {
	name: TName;
	setup: (params: { name: string }) => PluginSetup<TApi>;
};

export type AllHooksPlugin<TName extends string, TApi extends Record<string, unknown>> = Plugin<
	TName,
	Record<keyof Hooks, TApi>
>;

/**
 * Allows defining a type-safe plugin that can be used from any Astro hook.
 *
 * This is a wrapper over Astro Integration Kit's {@link definePlugin} that
 * automatically extends your plugin definition for any integration-defined
 * hook or future Astro hook.
 *
 * @see https://astro-integration-kit.netlify.app/utilities/define-plugin/
 */
export const allHooksPlugin = <TName extends string, TApi extends Record<string, unknown>>(
	plugin: AllHooksPluginDefinition<TName, TApi>
): AllHooksPlugin<TName, TApi> =>
	definePlugin({
		...plugin,
		setup: (params) => {
			const { [DEFAULT_HOOK_FACTORY]: defaultHookFactory, ...hooks } = plugin.setup(params);

			return new Proxy(hooks as ReturnType<Plugin<any, any>['setup']>, {
				// Has any key
				has: (target, prop) => typeof prop === 'string' || Reflect.has(target, prop),
				get: (target, prop, receiver) => {
					const realHook = Reflect.get(target, prop, receiver);
					if (realHook !== undefined || typeof prop !== 'string') return realHook;

					return defaultHookFactory(prop as keyof Hooks);
				},
			});
		},
	});
