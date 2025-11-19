import { parse } from 'devalue';
import { type State, ServerStateLoaded } from '../events.js';

const revivers: Record<string, (value: any) => any> = {
	URL: (value) => new URL(value),
	Date: (value) => new Date(value),
	GlobalSymbol: (value) => Symbol.for(value),
	WellKnownSymbol: (value) => Symbol[value as keyof typeof Symbol],
};

const loadState = (doc: Document, caller?: string): State[] => {
	const elements = Array.from(doc.querySelectorAll('.it-astro-state'));
	const scripts = elements
		.map((element) => {
			if (element?.textContent) {
				const state = parse(element.textContent, revivers);
				element.remove();
				return state;
			}
		})
		.filter(Boolean);
	return scripts;
};

let nextState = loadState(document, 'global');

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
			if (process.env.NODE_ENV === 'development') {
				console.warn(
					`@inox-tools/request-state: tried to insert duplicate key ${newKey} with value ${newValue} but already had value ${oldState.get(newKey)}. Ignoring.`
				);
			}
			continue;
		}
		oldState?.set(newKey, newValue);
	}
	return oldState;
};

const applyState =
	(isViewTransition: boolean = false) =>
	() => {
		const nextStateMerged = nextState?.reduce(mergeState, isViewTransition ? new Map() : state);
		const event = new ServerStateLoaded(new Map(state), nextStateMerged);

		if (document.dispatchEvent(event)) {
			for (const [key, value] of event.serverState.entries()) {
				state.set(key, value);
			}
		}
	};

applyState()();

document.addEventListener('astro:before-swap', (event) => {
	nextState = loadState(event.newDocument);
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

export const getAllState = () => state;

export const setState = (key: string, value: unknown): void => {
	if (value === undefined) {
		state.delete(key);
	} else {
		state.set(key, value);
	}
};
