import { Once } from '@inox-tools/utils/once';
import { addVitePlugin, defineUtility, type HookParameters } from 'astro-integration-kit';
import { writeFileSync, mkdirSync } from 'fs';
import { plugin, entrypoints } from './plugin.js';
import { resolveContentPaths } from '../internal/resolver.js';
import { seedCollections } from '../seedCollections.js';

export type Options = {
	/**
	 * Module to be imported with the configured collections.
	 *
	 * This module should be resolvable from the root of the Astro project and must export a `collections` object.
	 */
	entrypoint: string;

	/**
	 * Seed collections using this template if they are not present.
	 *
	 * @see {seedCollections}
	 */
	seedTemplateDirectory?: string;
};

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

	const contentPaths = resolveContentPaths(params.config);

	if (!contentPaths.configExists) {
		// Create the `<srcDir>/content/config.ts` file if it doesn't exist,
		// otherwise there is no module to modify in the Vite lifecycle.

		mkdirSync(contentPaths.contentPath, { recursive: true });
		writeFileSync(contentPaths.configPath, 'export const collections = {};');
	}

	// Install the plugin only once regardless of how many integrations use the utility
	// to avoid multiple wrappings like:
	//
	//   export const collections = withCollections(withCollections(withCollections(...)));
	installPluginOnce.do(() => {
		addVitePlugin(params, {
			plugin: plugin({ configFile: contentPaths.configPath, logger }),
			warnDuplicated: true,
		});
	});

	entrypoints.push(options.entrypoint);

	if (options.seedTemplateDirectory) {
		seedCollections(params, {
			templateDirectory: options.seedTemplateDirectory,
		});
	}
});
