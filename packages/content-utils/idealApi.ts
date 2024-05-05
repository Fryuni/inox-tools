import { externalCollections, darculaColorCollection } from '@it-astro:content-inject';
import { defineCollection } from 'astro:content';
import 'astro/env'; // Don't do this

export const idea6 = {
	docs: defineCollection({}),
	...externalCollections({
		darcula: {
			colors: {
				extend: (schema) => schema.and(),
			},
		},
		catpuccin: {},
	}),
};

// Without any extra config
export const idea7 = {
	docs: defineCollection({}),
};

// With some config to disable the auto-injection
export const idea7a = {
	darculaColors: darculaColorCollection({
		// extends: (schema, {image}) => schema,
		// extends: () => z.object(),

		// internalSchema.and(userSchema) --> Starlight way
		extends: ({ image }) => z.object(),
	}),
	docs: defineCollection({}),
};
