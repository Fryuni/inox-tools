import { Once } from '@inox-tools/utils/once';
import {
	addVitePlugin,
	createResolver,
	defineUtility,
	type HookParameters,
} from 'astro-integration-kit';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { plugin, entrypoints } from './plugin.js';
import { fileURLToPath } from 'url';

export type Options = {
	/**
	 * Module to be imported with the configured collections.
	 *
	 * This module should be resolvable from the root of the Astro project and must export a `collections` object.
	 */
	entrypoint: string;
};

// https://github.com/withastro/astro/blob/fd508a0f/packages/astro/src/content/utils.ts#L456
const possibleConfigs = ['config.mjs', 'config.js', 'config.mts', 'config.ts'];
const installPluginOnce = new Once();

/**
 * Inject a content collection definition alongside the project.
 *
 * Collections defined here can be overriden by the project.
 */
export const injectCollections = defineUtility('astro:config:setup')((
	params: HookParameters<'astro:config:setup'>,
	options: Options
) => {
	const logger = params.logger.fork('@inox-tools/content-utils');

	const resolver = createResolver(fileURLToPath(params.config.srcDir));

	const existingConfig = possibleConfigs
		.map((configPath) => resolver.resolve(`content/${configPath}`))
		.find((configPath) => existsSync(configPath));

	const configFile = existingConfig ?? resolver.resolve('content/config.ts');

	if (existingConfig === undefined) {
		// Create the `<srcDir>/content/config.ts` file if it doesn't exist,
		// otherwise there is no module to modify in the Vite lifecycle.

		mkdirSync(resolver.resolve('content'), { recursive: true });
		writeFileSync(configFile, 'export const collections = {};');
	}

	// Install the plugin only once regardless of how many integrations use the utility
	// to avoid multiple wrappings like:
	//
	//   export const collections = withCollections(withCollections(withCollections(...)));
	installPluginOnce.do(() => {
		addVitePlugin(params, {
			plugin: plugin({ configFile, logger }),
			warnDuplicated: true,
		});
	});

	entrypoints.push(options.entrypoint);
});
