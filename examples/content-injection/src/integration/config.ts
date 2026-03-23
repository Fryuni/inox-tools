import { defineCollection, z } from '@it-astro:content';
import { glob } from 'astro/loaders';

export const collections = {
	integrationDocs: defineCollection({
		loader: glob({ pattern: '**/*.md', base: './src/integration/integrationDocs' }),
		schema: z.object({
			title: z.string(),
		}),
	}),
};
