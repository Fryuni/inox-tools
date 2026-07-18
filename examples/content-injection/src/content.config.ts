import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
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
