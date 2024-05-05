import { defineUtility, type HookParameters } from 'astro-integration-kit';
import { resolveContentPaths } from './internal/resolver.js';
import { cpSync, existsSync, lstatSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

type Options = {
	/**
	 * Seed collections using this template if they are not present.
	 */
	templateDirectory: string;
};

export const seedCollections = defineUtility('astro:config:setup')((
	params: HookParameters<'astro:config:setup'>,
	options: Options
) => {
	const contentPaths = resolveContentPaths(params.config);

	// Pairs of collection names and the absolute path to their templates.
	const collectionTemplates = readdirSync(options.templateDirectory)
		.map((entry) => [entry, resolve(options.templateDirectory, entry)])
		.filter(([, path]) => lstatSync(path).isDirectory());

	for (const [collectionName, templatePath] of collectionTemplates) {
		const collectionPath = contentPaths.resolve(collectionName);

		if (existsSync(collectionPath)) {
			// Collection already exists, don't seed.
			params.logger.debug(`Collection ${collectionName} already present, not seeding.`);
			continue;
		}

		// TODO: Use a templating engine to allow for the template to refer project values
		cpSync(templatePath, collectionPath, {
			recursive: true,
			dereference: true,
			preserveTimestamps: false,
		});
	}
});
