import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { runHook, type PluginApi } from './hooks.js';

let logger: AstroIntegrationLogger;
let integrations: AstroIntegration[];

export const setGlobal = (
	newLogger: AstroIntegrationLogger,
	newIntegrations: AstroIntegration[]
) => {
	logger = newLogger;
	integrations = newIntegrations;
};

export const hooks: PluginApi['hooks'] = {
	run: (hook, params) => {
		if (logger === undefined || integrations === undefined || integrations.length === 0) {
			return Promise.reject(new Error('Cannot run hook at this point'));
		}
		return runHook(integrations, logger, hook, params);
	},
	getTrigger: (hook) => (params) => {
		if (logger === undefined || integrations === undefined || integrations.length === 0) {
			return Promise.resolve();
		}
		return runHook(integrations, logger, hook, params);
	},
};
