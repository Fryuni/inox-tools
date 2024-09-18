// Source: https://www.totaltypescript.com/concepts/the-prettify-helper
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type MaybePromise<T> = T | Promise<T>;

export type MaybeFactory<T> = T | (() => T);

export type MaybeThunk<T> = MaybeFactory<MaybePromise<T>>;
