import { defineCollection, z } from 'astro:content';

export const collections = {
  integrationDocs: defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
    }),
  }),
};
