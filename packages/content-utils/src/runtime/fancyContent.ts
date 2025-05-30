/// <reference types="astro/client" />

import {
	defineCollection as defineNative,
	z,
	type BaseSchema,
	type SchemaContext,
} from 'astro:content';

export type { BaseSchema };

// Copied from Starlight because Astro core doesn't export their definitions :(
// https://github.com/withastro/starlight/blob/95ace6d51c7bf631863b06ee46bbc9b6dff6828a/packages/starlight/schema.ts#L116-L123

/** Type that extends a collection's default schema with an optional, user-defined schema. */
export type ExtendedSchema<S extends BaseSchema, T extends BaseSchema | never = never> = [
	T,
] extends [never]
	? S
	: T extends BaseSchema
		? z.ZodIntersection<S, T>
		: S;

type CollectionConfig<S extends BaseSchema> = ReturnType<typeof defineNative<S>>;

export interface CollectionExtensionOptions<E extends BaseSchema> {
	extends?: E | ((context: SchemaContext) => E);
}

export type ExtendedCollection<S extends BaseSchema, E extends BaseSchema> =
	ExtendedSchema<S, E> extends BaseSchema
		? CollectionConfig<ExtendedSchema<S, E>>
		: CollectionConfig<S>;

export type FancyCollection<S extends BaseSchema = BaseSchema> = <E extends BaseSchema>(
	options?: CollectionExtensionOptions<E>
) => ExtendedCollection<S, E>;

/**
 * Define a collection from an integration that can be extended by users of the integration.
 *
 * Also known as a FancyCollection 💅
 */
export function defineCollection<S extends BaseSchema>(
	config: CollectionConfig<S>
): FancyCollection<S> {
	const definedConfig = defineNative(config);

	const fn = <E extends BaseSchema>(
		options?: CollectionExtensionOptions<E>
	): ExtendedCollection<S, E> => {
		const fancyMarker = {
			[FANCY_COLLECTION_MARKER]: fn,
		};

		if (options?.extends === undefined)
			return Object.assign(definedConfig as ExtendedCollection<S, E>, fancyMarker);

		// Make TS not forget about type narrowing;
		const { extends: extendSchema } = options;

		const config = {
			...definedConfig,
			schema: (context) => {
				const userSchema =
					typeof extendSchema === 'function' ? extendSchema(context) : extendSchema;

				const baseSchema =
					typeof definedConfig.schema === 'function'
						? definedConfig.schema(context)
						: definedConfig.schema;

				return baseSchema === undefined ? userSchema : baseSchema.and(userSchema);
			},
		} as ExtendedCollection<S, E>;

		return Object.assign(config, fancyMarker);
	};

	return Object.assign(fn, {
		[FANCY_COLLECTION_MARKER]: true,
	});
}

const FANCY_COLLECTION_MARKER = Symbol('@inox-tools/content-utils/fancyCollection');

type DerivedCollection = {
	[FANCY_COLLECTION_MARKER]: FancyCollection;
};

function isDerivedCollection(something: any): something is DerivedCollection {
	return typeof something[FANCY_COLLECTION_MARKER] === 'function';
}

/**
 * Guard checking that a value is a FancyCollection.
 */
export function isFancyCollection(something: any): something is FancyCollection {
	return something[FANCY_COLLECTION_MARKER] === true;
}

/**
 * Extract the original FancyCollection from a value, if it was derived from one.
 *
 * If the value was not derived from a FancyCollection, return null;
 */
export function tryGetOriginalFancyCollection(something: any): FancyCollection | null {
	return isDerivedCollection(something) ? something[FANCY_COLLECTION_MARKER] : null;
}
