import { file } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

export const collections = {
	entries: defineCollection({
		loader: file('src/content/entries.json'),
		schema: z.object({
			title: z.string(),
		}),
	}),
};
