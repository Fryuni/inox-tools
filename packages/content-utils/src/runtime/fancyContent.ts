/// <reference types="astro/client" />

import { defineCollection as defineNative, z, type SchemaContext } from 'astro:content';

// Copied from Starlight because Astro core doesn't export their definitions :(
// https://github.com/withastro/starlight/blob/95ace6d51c7bf631863b06ee46bbc9b6dff6828a/packages/starlight/schema.ts#L116-L123

/** Plain object, union, and intersection Zod types. */
type BaseSchemaWithoutEffects =
	| z.AnyZodObject
	| z.ZodUnion<[BaseSchemaWithoutEffects, ...BaseSchemaWithoutEffects[]]>
	| z.ZodDiscriminatedUnion<string, z.AnyZodObject[]>
	| z.ZodIntersection<BaseSchemaWithoutEffects, BaseSchemaWithoutEffects>;

/** Base subset of Zod types that we support passing to the `extend` option. */
export type BaseSchema = BaseSchemaWithoutEffects | z.ZodEffects<BaseSchemaWithoutEffects>;

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

export type FancyCollection<S extends BaseSchema> = <E extends BaseSchema>(
	options?: CollectionExtensionOptions<E>
) => ExtendedCollection<S, E>;

export function defineCollection<S extends BaseSchema>(
	config: CollectionConfig<S>
): FancyCollection<S> {
	const definedConfig = defineNative(config);

	return <E extends BaseSchema>(
		options?: CollectionExtensionOptions<E>
	): ExtendedCollection<S, E> => {
		if (options?.extends === undefined) return definedConfig as ExtendedCollection<S, E>;

		// Make TS not forget about type narrowing;
		const { extends: extendSchema } = options;

		return {
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
	};
}
