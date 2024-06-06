import { cpSync, existsSync, lstatSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IntegrationState } from './state.js';

export type SeedCollectionsOptions = {
	/**
	 * Seed collections using this template if they are not present.
	 */
	templateDirectory: string;
};

export function seedCollections(state: IntegrationState, options: SeedCollectionsOptions) {
	// Pairs of collection names and the absolute path to their templates.
	const collectionTemplates = readdirSync(options.templateDirectory)
		.map((entry) => [entry, resolve(options.templateDirectory, entry)])
		.filter(([, path]) => lstatSync(path).isDirectory());

	for (const [collectionName, templatePath] of collectionTemplates) {
		const collectionPath = state.contentPaths.resolve(collectionName);

		if (existsSync(collectionPath)) {
			// Collection already exists, don't seed.
			state.logger.debug(`Collection ${collectionName} already present, not seeding.`);
			continue;
		}

		// TODO: Use a templating engine to allow for the template to refer project values
		cpSync(templatePath, collectionPath, {
			recursive: true,
			dereference: true,
			preserveTimestamps: false,
		});
	}
}
