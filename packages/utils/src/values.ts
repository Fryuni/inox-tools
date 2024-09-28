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
