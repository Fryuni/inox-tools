import { parse } from 'devalue';
import { type State, ServerStateLoaded } from '../events.js';

const revivers: Record<string, (value: any) => any> = {
	URL: (value) => new URL(value),
	Date: (value) => new Date(value),
	GlobalSymbol: (value) => Symbol.for(value),
	WellKnownSymbol: (value) => Symbol[value as keyof typeof Symbol],
};

const loadState = (doc: Document): State | undefined => {
	const element = doc.getElementById('it-astro-state');

	if (element?.textContent) {
		const state = parse(element.textContent, revivers);
		element.remove();
		return state;
	}
};

let nextState = loadState(document);
const state = new Map();

const applyState = () => {
	const event = new ServerStateLoaded(new Map(state), nextState ?? new Map());

	if (document.dispatchEvent(event)) {
		state.clear();
		for (const [key, value] of event.serverState.entries()) {
			state.set(key, value);
		}
	}
};

applyState();

document.addEventListener('astro:before-swap', (event) => {
	nextState = loadState(event.newDocument);
});
document.addEventListener('astro:after-swap', applyState);

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
