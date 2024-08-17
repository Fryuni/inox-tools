import { parse } from 'devalue';

const revivers: Record<string, (value: any) => any> = {
	URL: (value) => new URL(value),
	Date: (value) => new Date(value),
	GlobalSymbol: (value) => Symbol.for(value),
	WellKnownSymbol: (value) => Symbol[value as keyof typeof Symbol],
};

type State = Map<string, unknown>;

let nextState: State | undefined = undefined;

document.addEventListener('astro:before-swap', (event) => {
	nextState = loadState(event.newDocument);
});

document.addEventListener('astro:after-swap', () => {
	state.clear();
	if (nextState !== undefined) {
		for (const [key, value] of nextState) {
			state.set(key, value);
		}
	}
});

const loadState = (doc: Document): State | undefined => {
	const element = doc.getElementById('it-astro-state');

	if (element?.textContent) {
		const state = parse(element.textContent, revivers);
		element.remove();
		return state;
	}
};

const state = loadState(document) ?? new Map();

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
