import { defineIntegration, addVitePlugin } from 'astro-integration-kit';
import { z } from 'astro/zod';
import debugC from 'debug';

const debug = debugC('inox-tools:astro-when');

const VIRTUAL_MODULE_ID = '@it-astro:when';
const RESOLVED_MODULE_ID = `\x00${VIRTUAL_MODULE_ID}`;

// Globally indicate to the virtual module that it is in the same context as the build system.
const key = Symbol.for('astro:when/buildContext');

export default defineIntegration({
	name: '@inox-tools/astro-when',
	optionsSchema: z.never().optional(),
	setup: () => ({
		hooks: {
			'astro:config:setup': (params) => {
				const outputMode = params.config.output;
				const command = params.command;

				(globalThis as any)[key] = command === 'build';

				debug('Adding Vite plugin');
				addVitePlugin(params, {
					plugin: {
						name: '@inox-tools/astro-when',
						resolveId(id) {
							if (id === VIRTUAL_MODULE_ID) {
								debug('Resolving virtual module ID');
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
								debug('Generating module for client');
								return `${preamble} export const whenAmI = When.Client;`;
							}

							if (command === 'dev') {
								debug('Generating module for dev server');
								return `${preamble} export const whenAmI = When.DevServer;`;
							}

							if (outputMode === 'static') {
								debug('Generating module for static build');
								return `${preamble} export const whenAmI = When.StaticBuild;`;
							}

							debug('Generating module for live server');
							return `${preamble}
              const isBuildContext = Symbol.for('astro:when/buildContext');
              export const whenAmI = globalThis[isBuildContext] ? When.Prerender : When.Server;
            `;
						},
					},
				});
			},
			'astro:config:done': (params) => {
				// Check if the version of Astro being used has the `injectTypes` utility.
				if (typeof params.injectTypes === 'function') {
					debug('Injecting types in .astro structure');
					params.injectTypes({
						filename: 'types.d.ts',
						content: "import '@inox-tools/astro-when';",
					});
				}
			},
			'astro:build:done': () => {
				delete (globalThis as any)[key];
			},
		},
	}),
});
