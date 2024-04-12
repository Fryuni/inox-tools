import { defineIntegration, addVitePlugin } from 'astro-integration-kit';
import { z } from 'astro/zod';

const VIRTUAL_MODULE_ID = '@it-astro:when';
const RESOLVED_MODULE_ID = `\x00${VIRTUAL_MODULE_ID}`;

// Globally indicate to the virtual module that it is in the same context as the build system.
const key = Symbol.for('astro:when/buildContext');

export default defineIntegration({
	name: '@inox-tools/astro-when',
	optionsSchema: z.never().optional(),
	setup: () => ({
		'astro:config:setup': (params) => {
			const outputMode = params.config.output;
			const command = params.command;

			(globalThis as any)[key] = command === 'build';

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
							return `${preamble} export const whenAmI = When.Client;`;
						}

						if (command === 'dev') {
							return `${preamble} export const whenAmI = When.DevServer;`;
						}

						if (outputMode === 'static') {
							return `${preamble} export const whenAmI = When.StaticBuild;`;
						}

						return `${preamble}
              const isBuildContext = Symbol.for('astro:when/buildContext');
              export const whenAmI = globalThis[isBuildContext] ? When.Prerender : When.Server;
            `;
					},
				},
			});
		},
	}),
});
