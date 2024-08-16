import { parse } from 'devalue';

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

const loadState = (): Map<string, unknown> => {
	const element = document.getElementById('it-astro-state');

	if (element?.textContent) {
		const state = parse(element.textContent);
		element.remove();
		return state;
	}

	return new Map();
};

const state = loadState();

export const getState = (key: string): unknown | undefined => {
	return state.get(key);
};

export const setState = (key: string, value: unknown): void => {
	if (value === undefined) {
		state.delete(key);
	} else {
		state.set(key, value);
	}
};
