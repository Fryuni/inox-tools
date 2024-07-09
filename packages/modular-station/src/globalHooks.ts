import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { runHook, type PluginApi } from './hooks.js';

type Reference = {
	logger?: AstroIntegrationLogger;
	integrations?: AstroIntegration[];
};

const referenceState: Reference = ((globalThis as any)[
	Symbol.for('@inox-tools/modular-station:globalHooks')
] ??= {});

export const setGlobal = (
	newLogger: AstroIntegrationLogger,
	newIntegrations: AstroIntegration[]
) => {
	referenceState.logger = newLogger;
	referenceState.integrations = newIntegrations;
};

export const hooks: PluginApi['hooks'] = {
	run: (hook, params) => {
		const { logger, integrations } = referenceState;
		if (logger === undefined || integrations === undefined || integrations.length === 0) {
			return Promise.reject(new Error('Cannot run hook at this point'));
		}
		return runHook(integrations, logger, hook, params);
	},
	getTrigger: (hook) => (params) => {
		const { logger, integrations } = referenceState;
		if (logger === undefined || integrations === undefined || integrations.length === 0) {
			return Promise.resolve();
		}
		return runHook(integrations, logger, hook, params);
	},
};
