import { computed, type ReadableAtom } from 'nanostores';

type ResolvedArray<T extends any[]> = T extends [infer H, ...infer R]
	? [Resolved<H>, ...ResolvedArray<R>]
	: [];

type ResolvedObject<T extends Record<any, any>> = {
	[K in keyof T]: Resolved<T[K]>;
};

/**
 * Recursively unwraps all {@link ReadableAtom} instances in a type to their inner values.
 *
 * - Atoms become their contained value type.
 * - Arrays and tuples are resolved element-wise.
 * - Objects are resolved property-wise.
 * - Primitives pass through unchanged.
 */
export type Resolved<T> =
	T extends Array<any>
		? ResolvedArray<T>
		: T extends ReadableAtom<infer U>
			? U
			: T extends Record<any, any>
				? ResolvedObject<T>
				: T;

function isResolvable(value: Record<any, any>): value is ReadableAtom<any> {
	return typeof value.lc === 'number' && typeof value.listen === 'function';
}

function resolveNested<T>(value: T): Resolved<T> {
	if (typeof value !== 'object' || value === null) return value as Resolved<T>;
	if (isResolvable(value)) {
		return value.value;
	}
	if (Array.isArray(value)) return value.map((item) => resolveNested(item)) as Resolved<T>;
	return Object.fromEntries(
		Object.entries(value).map(([key, value]) => [key, resolveNested(value)])
	) as Resolved<T>;
}

function findDependencies(value: unknown): ReadableAtom[] {
	const dependencies = new Set<ReadableAtom>();
	const stack = [value];

	while (stack.length > 0) {
		const current = stack.pop();
		if (typeof current !== 'object' || current === null) continue;
		if (isResolvable(current)) {
			dependencies.add(current);
			continue;
		}
		stack.push(...(Array.isArray(current) ? current : Object.values(current)));
	}

	return Array.from(dependencies.values());
}

/**
 * Creates a read-only computed atom that deeply resolves all nested {@link ReadableAtom}
 * instances in the given value, reactively updating when any of them changes.
 *
 * @example
 * ```ts
 * const $name = atom('Alice');
 * const $age = atom(30);
 *
 * const $user = resolvedAtom({ name: $name, age: $age, role: 'admin' });
 * $user.get(); // { name: 'Alice', age: 30, role: 'admin' }
 *
 * $name.set('Bob');
 * $user.get(); // { name: 'Bob', age: 30, role: 'admin' }
 * ```
 *
 * @param value - A value tree that may contain atoms at any depth.
 * @returns A readable atom whose value is the deeply-resolved snapshot of the input.
 */
export function resolvedAtom<T>(value: T): ReadableAtom<Resolved<T>> {
	const dependencies = findDependencies(value);

	return computed(dependencies, () => resolveNested(value));
}
