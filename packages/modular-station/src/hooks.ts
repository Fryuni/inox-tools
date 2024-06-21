import type { Hooks } from 'astro-integration-kit';
import type { AstroIntegration } from 'astro';
import { DEFAULT_HOOK_FACTORY, allHooksPlugin } from './allHooksPlugin.js';

type ToHookFunction<F> = F extends (...params: infer P) => any
	? (...params: P) => Promise<void> | void
	: never;

type ExtendedHooks = {
	[H in keyof Required<Hooks>]: ToHookFunction<NonNullable<Hooks[H]>>;
};

function getHook<K extends keyof ExtendedHooks>(
	hookName: K,
	hookMap?: Partial<ExtendedHooks>
): Function | undefined {
	const hook = hookMap?.[hookName];

	return typeof hook === 'function' ? hook : undefined;
}

export async function runHook<K extends keyof ExtendedHooks>(
	integrations: AstroIntegration[],
	hook: K,
	...params: Parameters<ExtendedHooks[K]>
): Promise<void> {
	for (const integration of integrations) {
		await getHook(hook, integration.hooks)?.(...params);
	}
}

export type PluginApi = {
	/**
	 * Execute a custom async hook.
	 */
	runHook<K extends keyof ExtendedHooks>(
		hook: K,
		...params: Parameters<ExtendedHooks[K]>
	): Promise<void>;

	/**
	 * Returns a function that, when called, triggers a hook on all integrations.
	 */
	getTrigger<K extends keyof ExtendedHooks>(hook: K): HookTrigger<K>;
};

/**
 * A function that triggers a hook on all integrations when called.
 */
export type HookTrigger<K extends keyof ExtendedHooks> = (
	...params: Parameters<ExtendedHooks[K]>
) => Promise<void>;

export const hookProviderPlugin = allHooksPlugin({
	name: 'hook-provider',
	setup() {
		let integrations: AstroIntegration[];

		const pluginApi: PluginApi = {
			runHook: (hook, ...params) => runHook(integrations, hook, ...params),
			getTrigger:
				(hook) =>
				(...params) =>
					runHook(integrations, hook, ...params),
		};

		return {
			'astro:config:setup': ({ config }) => {
				integrations = config.integrations;

				return pluginApi;
			},
			'astro:config:done': ({ config }) => {
				integrations = config.integrations;

				return pluginApi;
			},
			[DEFAULT_HOOK_FACTORY]: () => () => pluginApi,
		};
	},
});
