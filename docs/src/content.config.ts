import { docsSchema } from '@astrojs/starlight/schema';
import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

export const collections = {
	docs: defineCollection({
		loader: glob({
			base: 'src/content/docs',
			pattern: '**',
		}),
		schema: docsSchema({
			extend: z.object({
				packageName: z.string().optional(),
				howItWorks: z.string().optional(),
			}),
		}),
	}),
};
