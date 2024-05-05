import { defineCollection, z } from '@it-astro:content';

export const collections = {
	integrationDocs: defineCollection({
		type: 'content',
		schema: z.object({
			title: z.string(),
		}),
	}),
};
