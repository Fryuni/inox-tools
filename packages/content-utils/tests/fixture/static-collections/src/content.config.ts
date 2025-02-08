import { file } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

export const collections = {
	'static-only': defineCollection({
		loader: file('src/content/static.json'),
		schema: z.object({
			content: z.string(),
		}),
	}),
	'on-demand': defineCollection({
		loader: file('src/content/dynamic.json'),
		schema: z.object({
			content: z.string(),
		}),
	}),
};
