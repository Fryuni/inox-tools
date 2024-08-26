import { defineIntegration, addVitePlugin } from 'astro-integration-kit';
import { z } from 'astro/zod';
import { join as posixJoin } from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import { debug } from './debug.js';
import { BUILD_CONTEXT_KEY, plugin } from './plugin.js';

export default defineIntegration({
	name: '@inox-tools/astro-when',
	optionsSchema: z.never().optional(),
	setup: () => {
		const routeComponents = new Set<string>();
		let rootDir = process.cwd();

		return {
			hooks: {
				'astro:config:setup': (params) => {
					const command = params.command;
					rootDir = fileURLToPath(params.config.root);

					(globalThis as any)[BUILD_CONTEXT_KEY] = command === 'build';

					debug('Adding Vite plugin');
					addVitePlugin(params, {
						plugin: plugin({
							command,
							routeComponents,
							outputMode: params.config.output,
							pagesPath: fileURLToPath(new URL('pages/', params.config.srcDir)),
						}),
					});
				},
				'astro:route:setup': (params) => {
					const componentPath = posixJoin(rootDir, params.route.component);
					routeComponents.add(componentPath);

					params.logger.info(`Route ${componentPath} will prerender: ${params.route.prerender}`);
				},
			},
		};
	},
});
