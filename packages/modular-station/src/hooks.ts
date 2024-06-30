import type { Hooks } from 'astro-integration-kit';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
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
	baseLogger: AstroIntegrationLogger,
	hook: K,
	paramsFactory: (logger: AstroIntegrationLogger) => Parameters<ExtendedHooks[K]>
): Promise<void> {
	for (const integration of integrations) {
		const logger = baseLogger.fork(`${baseLogger.label}/${integration.name}`);

		await getHook(hook, integration.hooks)?.(...paramsFactory(logger));
	}
}

export type PluginApi = {
	hooks: {
		/**
		 * Execute a hook on all integrations.
		 */
		run<K extends keyof ExtendedHooks>(
			hook: K,
			paramsFactory: (logger: AstroIntegrationLogger) => Parameters<ExtendedHooks[K]>
		): Promise<void>;

		/**
		 * Returns a function that, when called, triggers a hook on all integrations.
		 */
		getTrigger<K extends keyof ExtendedHooks>(hook: K): HookTrigger<K>;
	};
};

/**
 * A function that triggers a hook on all integrations when called.
 */
export type HookTrigger<K extends keyof ExtendedHooks> = (
	paramsFactory: (logger: AstroIntegrationLogger) => Parameters<ExtendedHooks[K]>
) => Promise<void>;

export const hookProviderPlugin = allHooksPlugin({
	name: 'hook-provider',
	setup() {
		let logger: AstroIntegrationLogger;
		let integrations: AstroIntegration[];

		const pluginApi: PluginApi = {
			hooks: {
				run: (hook, params) => runHook(integrations, logger, hook, params),
				getTrigger: (hook) => (params) => runHook(integrations, logger, hook, params),
			},
		};

		return {
			'astro:config:setup': ({ config, logger: hookLogger }) => {
				integrations = config.integrations;
				logger = hookLogger;

				return pluginApi;
			},
			'astro:config:done': ({ config, logger: hookLogger }) => {
				integrations = config.integrations;
				logger = hookLogger;

				return pluginApi;
			},
			[DEFAULT_HOOK_FACTORY]: () => () => pluginApi,
		};
	},
});
