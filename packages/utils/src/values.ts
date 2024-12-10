/**
 * A value that can be might be pending to be resolved.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * A value or a thunk for a value.
 *
 * A "thunk" is a function that takes no arguments and return
 * a value that is potentially expensive to compute.
 * This can be used when the value might not be needed and as
 * such can be computed on demand potentially saving the
 * expensive computation.
 *
 * If the value is not expensive to compute it can be used directly
 * for simplicity.
 *
 * A value type that is itself a function cannot be a "maybe" thunk.
 *
 * @see https://en.wikipedia.org/wiki/Thunk
 */
export type MaybeThunk<T> = T extends Function ? never : T | (() => T);

/**
 * A value or a thunk for a synchronous or asynchronous value.
 *
 * @see MaybePromise
 * @see MaybeThunk
 */
export type MaybeAsyncThunk<T> = MaybeThunk<MaybePromise<T>>;

/**
 * Load a value from a possibly thunk argument.
 *
 * If the value is a thunk it is called and the result is returned.
 * Otherwise the value itself is returned.
 *
 * @see MaybeThunk
 */
export function loadThunkValue<T>(value: MaybeThunk<T>): T {
	return typeof value === 'function' ? value() : value;
}

type NextDepth = [1, 2, 3, 4, 5, 6, 7];

/**
 * Extract key-value entry pairs for each node in an object tree.
 */
export type NodeEntries<T, NoCircle = never, MaxDepth extends number = 0> = MaxDepth extends 7
	? never
	: T extends object
		? {
				[Key in keyof T & string]-?: T[Key] extends NoCircle
					? never
					: NodeEntries<T[Key], NoCircle | T[Key], NextDepth[MaxDepth]> extends infer Nested
						? Nested extends { key: string; value: unknown }
							? Nested['key'] extends ''
								? {
										key: Key;
										value: Nested['value'];
									}
								:
										| { key: Key; value: T[Key] }
										| {
												key: `${Key}.${Nested['key']}`;
												value: Nested['value'];
										  }
							: never
						: never;
			}[keyof T & string]
		: { key: ''; value: T };

/**
 * Sets a value nested in an object tree, creating the path as needed.
 */
export function setNested<T extends object, const P extends NodeEntries<T>['key']>(
	obj: T,
	prop: P,
	value: Extract<NodeEntries<T>, { key: P }>['value']
): void {
	if (obj == null) throw new Error('Root object is nullish.');
	const parts = prop.split('.');

	let current: any = obj;
	for (const [idx, propName] of parts.slice(0, -1).entries()) {
		const next = current[propName];
		const path = parts.slice(0, idx).join('.');

		if (next == null) {
			current = current[propName] = {};
			continue;
		}

		if (typeof next !== 'object')
			throw new Error(`Cannot set property on ${typeof next} value at "${path}".`);

		current = next;
	}

	current[parts[parts.length - 1]] = value;
}

/**
 * Sets a value nested in an object tree, creating the path as needed, if it is not already set to a non-nullish value.
 */
export function setNestedIfNullish<T extends object, const P extends NodeEntries<T>['key']>(
	obj: T,
	prop: P,
	value: Extract<NodeEntries<T>, { key: P }>['value']
): void {
	if (obj == null) throw new Error('Root object is nullish.');
	const parts = prop.split('.');

	let current: any = obj;
	for (const [idx, propName] of parts.slice(0, -1).entries()) {
		const next = current[propName];
		const path = parts.slice(0, idx).join('.');

		if (next == null) {
			current = current[propName] = {};
			continue;
		}

		if (typeof next !== 'object')
			throw new Error(`Cannot set property on ${typeof next} value at "${path}".`);

		current = next;
	}

	const key = parts[parts.length - 1];
	if (current[key] == null) {
		current[parts[parts.length - 1]] = value;
	}
}
