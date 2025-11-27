import { AsyncLocalStorage } from 'node:async_hooks';
import { stringify } from 'devalue';

type State = Map<string, unknown>;

const store = new AsyncLocalStorage<State>();

export const getState = (key: string, valueIfMissing?: unknown): unknown => {
	const state = store.getStore();
	if (state === undefined) return;

	if (!state.has(key)) {
		if (valueIfMissing !== undefined) {
			state.set(key, valueIfMissing);
		}
	}
	return state.get(key);
};

export const hasState = (key: string) => store.getStore()?.has(key) || false

export const setState = (key: string, value: unknown): void => {
	const state = store.getStore();
	if (value === undefined) {
		state?.delete(key);
	} else {
		state?.set(key, value);
	}
};

export type CollectedState<T> = {
	getState: () => string | false;
	result: T;
};

const wellKnownSymbols = new Map(
	Object.entries(Symbol)
		.filter(([key, value]) => typeof value === 'symbol' && typeof key === 'string')
		.map(([key, value]) => [value, key])
);

const reducers: Record<string, (value: any) => any> = {
	URL: (value) => value instanceof URL && value.href,
	Date: (value) => value instanceof Date && value.valueOf(),
	GlobalSymbol: (value) =>
		typeof value === 'symbol' &&
		value.description !== undefined &&
		value === Symbol.for(value.description) &&
		value.description,
	WellKnownSymbol: (value) => typeof value === 'symbol' && wellKnownSymbols.get(value),
};

export const collectState = async <R>(cb: () => Promise<R>): Promise<CollectedState<R>> => {
	const state = new Map();
	const result = await store.run(state, cb);
	return {
		result,
		getState: () => state.size > 0 && stringify(state, reducers),
	};
};
