import { cpSync, existsSync, lstatSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IntegrationState } from './state.js';
import { getDebug } from '../internal/debug.js';

export type SeedCollectionsOptions = {
	/**
	 * Seed collections using this template if they are not present.
	 */
	templateDirectory: string;
};

const debug = getDebug('seeding');

export function seedCollections(state: IntegrationState, options: SeedCollectionsOptions) {
	debug('Collecting collection templates from:', options.templateDirectory);
	// Pairs of collection names and the absolute path to their templates.
	const collectionTemplates = readdirSync(options.templateDirectory)
		.map((entry) => [entry, resolve(options.templateDirectory, entry)])
		.filter(([, path]) => lstatSync(path).isDirectory());

	for (const [collectionName, templatePath] of collectionTemplates) {
		const collectionPath = state.contentPaths.resolve(collectionName);

		if (existsSync(collectionPath)) {
			// Collection already exists, don't seed.
			debug(`Collection ${collectionName} already present, not seeding.`);
			continue;
		}

		debug(`Seeding collection ${collectionName} from ${templatePath}`);

		// TODO: Use a templating engine to allow for the template to refer project values
		cpSync(templatePath, collectionPath, {
			recursive: true,
			dereference: true,
			preserveTimestamps: false,
		});
	}
}
