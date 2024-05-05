import { defineCollection, z } from 'astro:content';
import { collections as integrationCollections } from '../integration/config';

export const collections = {
	blog: defineCollection({
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
