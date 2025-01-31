import type { Hooks } from 'astro-integration-kit';
import type { AstroIntegration, AstroIntegrationLogger, HookParameters } from 'astro';
import { DEFAULT_HOOK_FACTORY, allHooksPlugin } from './allHooksPlugin.js';
import { setGlobal } from './globalHooks.js';

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
		const logger = baseLogger.fork(integration.name);

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

const globalHookIntegrationName = '@inox-tools/modular-station/global-hooks';
const versionMarker = Symbol(globalHookIntegrationName);

type MarkedIntegration = AstroIntegration & {
	[versionMarker]: true;
};

export const registerGlobalHooks = (params: HookParameters<'astro:config:setup'>) => {
	// Register immediately so hooks can be triggered from calls within the current hook
	setGlobal(params.logger, params.config.integrations);

	if (
		params.config.integrations.some(
			(i) =>
				i.name === globalHookIntegrationName &&
				// Check for a version marker so duplicate dependencies
				// of incompatible versions don't conflict
				versionMarker in i &&
				i[versionMarker] === true
		)
	) {
		// Global hooks already registered
		return;
	}

	const integration: MarkedIntegration = {
		name: globalHookIntegrationName,
		[versionMarker]: true,
		hooks: {
			'astro:config:setup': (params) => {
				setGlobal(params.logger, params.config.integrations);
			},
			'astro:config:done': (params) => {
				setGlobal(params.logger, params.config.integrations);
			},
		},
	};

	params.config.integrations.push(integration);
};
