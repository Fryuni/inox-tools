import { defineIntegration, addVitePlugin } from 'astro-integration-kit';
import { z } from 'astro/zod';

const VIRTUAL_MODULE_ID = '@it-astro:when';
const RESOLVED_MODULE_ID = `\x00${VIRTUAL_MODULE_ID}`;

// Globally indicate to the virtual module that it is in the same context as the build system.
const key = Symbol.for('astro:when/buildContext');
(globalThis as any)[key] = true;

export default defineIntegration({
	name: '@inox-tools/astro-when',
	optionsSchema: z.never(),
	setup: () => ({
		'astro:config:setup': (params) => {
			const outputMode = params.config.output;
			const command = params.command;

			addVitePlugin(params, {
				plugin: {
					name: '@inox-tools/astro-when',
					resolveId(id) {
						if (id === VIRTUAL_MODULE_ID) {
							return RESOLVED_MODULE_ID;
						}
					},
					load(id, options) {
						if (id !== RESOLVED_MODULE_ID) return;

						const preamble = `
              export const When = {
                Client: 'client',
                Server: 'server',
                Prerender: 'prerender',
                StaticBuild: 'staticBuild',
                DevServer: 'devServer',
              };
            `;

						if (options?.ssr !== true) {
							return `${preamble} export const currentCycle = When.Client;`;
						}

						if (command === 'dev') {
							return `${preamble} export const currentCycle = When.DevServer;`;
						}

						if (outputMode === 'static') {
							return `${preamble} export const currentCycle = When.StaticBuild;`;
						}

						return `${preamble}
              const isBuildContext = Symbol.for('astro:when/buildContext');
              export const currentCycle = globalThis[isBuildContext] ? When.Prerender : When.Server;
            `;
					},
				},
			});
		},
	}),
});
