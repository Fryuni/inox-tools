import { parse } from 'devalue';

const revivers: Record<string, (value: any) => any> = {
	URL: (value) => new URL(value),
	Date: (value) => new Date(value),
	GlobalSymbol: (value) => Symbol.for(value),
	WellKnownSymbol: (value) => Symbol[value as keyof typeof Symbol],
};

const loadState = (): Map<string, unknown> => {
	const element = document.getElementById('it-astro-state');

	if (element?.textContent) {
		const state = parse(element.textContent, revivers);
		element.remove();
		return state;
	}

	return new Map();
};

const state = loadState();

export const getState = (key: string, valueIfMissing?: unknown): unknown => {
	if (!state.has(key)) {
		if (valueIfMissing !== undefined) {
			state.set(key, valueIfMissing);
		}
	}
	return state.get(key);
};

export const setState = (key: string, value: unknown): void => {
	if (value === undefined) {
		state.delete(key);
	} else {
		state.set(key, value);
	}
};
