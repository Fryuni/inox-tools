import { parse } from 'devalue';
import { type State, ServerStateLoaded } from '../events.js';

const revivers: Record<string, (value: any) => any> = {
	undefined: () => undefined,
	URL: (value) => new URL(value),
	Date: (value) => new Date(value),
	GlobalSymbol: (value) => Symbol.for(value),
	WellKnownSymbol: (value) => Symbol[value as keyof typeof Symbol],
};

const loadState = (doc: Document): State[] => {
	const elements = Array.from(doc.querySelectorAll('script.it-astro-state'));
	const scripts = elements
		.map((element) => {
			if (element?.textContent) {
				const state = parse(element.textContent, revivers);
				element.remove();
				return state;
			}
		})
		.filter((state): state is State => !!state);
	return scripts;
};

let nextStates = loadState(document);

const initialiseState = (): State => {
	const STATE_WINDOW_NAMESPACE = '__@it-astro:request-state-data' as const;
	if (!(STATE_WINDOW_NAMESPACE in window)) {
		window[STATE_WINDOW_NAMESPACE] = new Map();
	}
	return window[STATE_WINDOW_NAMESPACE] as State;
};

export const state = initialiseState();

const mergeState = (oldState: State, newState: State) => {
	for (const [newKey, newValue] of newState.entries()) {
		const isHit = oldState.has(newKey);
		if (isHit) {
			continue;
		}
		oldState.set(newKey, newValue);
	}
	return oldState;
};

const applyState =
	(isViewTransition: boolean = false) =>
	() => {
		/*
		If it's an uncancelled view transition, we want a completely new state 
		(otherwise the new view will 'lose' to the old view in the case of a conflict). 
		If it's not a view transition, we want to shallow clone the state object.
		mergeState will update the top-level keys of the state passed to it, but if 
		the user calls preventDefault on the serverStateLoaded we're supposed to abort 
		the update. So it won't do to have already updated the underlying global state 
		map. And on the other hand we do a shallow, not deep, clone because the user 
		can mutate their own stored values any time they want.
		*/
		const startingState = isViewTransition ? new Map() : new Map(state);
		nextStates?.reduce(mergeState, startingState);
		const event = new ServerStateLoaded(new Map(state), startingState, {
			cancelable: true,
		});

		if (document.dispatchEvent(event)) {
			state.clear();
			for (const [key, value] of event.serverState.entries()) {
				state.set(key, value);
			}
		}
	};

applyState()();

document.addEventListener('astro:before-swap', (event) => {
	nextStates = loadState(event.newDocument);
});
document.addEventListener('astro:after-swap', applyState(true));

export const getState = (key: string, valueIfMissing?: unknown): unknown => {
	if (!state.has(key)) {
		if (valueIfMissing !== undefined) {
			state.set(key, valueIfMissing);
		}
	}
	return state.get(key);
};

export const hasState = (key: string) => state.has(key);

export const setState = (key: string, value: unknown): void => {
	state.set(key, value);
};
