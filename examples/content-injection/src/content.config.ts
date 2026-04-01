import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { collections as integrationCollections } from './integration/config';

export const collections = {
	blog: defineCollection({
		loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
		schema: z.object({
			title: z.string(),
		}),
	}),
	integrationDocs: integrationCollections.integrationDocs({
		extends: ({ image }) =>
			z.object({
				card: image(),
			}),
	}),
};
