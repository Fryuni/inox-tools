import type { ReadableAtom } from 'nanostores';
import { hasState, setState, getState } from '@it-astro:state';

const STATE_NAMESPACE = '@inox-tools/request-nanostores:';

export const shared = <A extends ReadableAtom<any>>(name: string, store: A): A => {
	const baseValue = store.value;

	Object.defineProperty(store, 'value', {
		configurable: false,
		enumerable: true,
		get() {
			if (!hasState(STATE_NAMESPACE + name)) {
				setState(STATE_NAMESPACE + name, structuredClone(baseValue));
			}
			return getState(STATE_NAMESPACE + name);
		},
		set(value) {
			setState(STATE_NAMESPACE + name, value);
		},
	});

	return store;
};
