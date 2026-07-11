import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
