import type { AstroIntegration } from 'astro';
import { definePlugin } from 'astro-integration-kit';

export type AsyncHooks = {
	[K in keyof Required<AstroLibs.Hooks>]: NonNullable<AstroLibs.Hooks[K]> extends (
		...params: any[]
	) => Promise<any>
		? K
		: never;
}[keyof AstroLibs.Hooks];

export type SyncHooks = {
	[K in keyof Required<AstroLibs.Hooks>]: NonNullable<AstroLibs.Hooks[K]> extends (
		...params: any[]
	) => Promise<any>
		? never
		: K;
}[keyof AstroLibs.Hooks];

export async function execLibHook<K extends AsyncHooks>(
	integrations: AstroIntegration[],
	hook: K,
	...params: Parameters<AstroLibs.Hooks[K]>
): Promise<void> {
	for (const integration of integrations) {
		const libHooks = integration.libHooks;
		if (!libHooks) continue;

		const hookImpl = libHooks[hook];
		if (!hookImpl) continue;

		await (hookImpl as Function)(structuredClone(params));
	}
}

export function execLibHookSync<K extends SyncHooks>(
	integrations: AstroIntegration[],
	hook: K,
	...params: Parameters<AstroLibs.Hooks[K]>
): void {
	for (const integration of integrations) {
		const libHooks = integration.libHooks;
		if (!libHooks) continue;

		const hookImpl = libHooks[hook];
		if (!hookImpl) continue;

		(hookImpl as Function)(structuredClone(params));
	}
}

export interface PluginApi {
	[k: string]: unknown;
	execLibHook<K extends AsyncHooks>(
		hook: K,
		...params: Parameters<AstroLibs.Hooks[K]>
	): Promise<void>;
	execLibHookSync<K extends SyncHooks>(hook: K, ...params: Parameters<AstroLibs.Hooks[K]>): void;
}

export const hookProviderPlugin = definePlugin({
	name: 'hook-provider',
	setup() {
		let integrations: AstroIntegration[];

		const pluginApi: PluginApi = {
			execLibHook: async (hook, ...params) => execLibHook(integrations, hook, ...params),
			execLibHookSync: (hook, ...params) => execLibHookSync(integrations, hook, ...params),
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
});

declare global {
	namespace AstroLibs {
		interface Hooks {}
	}
}

declare module 'astro' {
	export interface AstroIntegration {
		libHooks?: AstroLibs.Hooks;
	}
}
