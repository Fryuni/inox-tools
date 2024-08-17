import type { ReadableAtom } from 'nanostores';
import { getState } from '@it-astro:state';

const STATE_NAMESPACE = '@inox-tools/request-nanostores';

type Stores = Map<string, any>;

function getAtomStore(): Stores {
	return getState(STATE_NAMESPACE, new Map()) as Stores;
}

export const shared = <A extends ReadableAtom<any>>(name: string, store: A): A => {
	const baseValue = store.value;

	Object.defineProperty(store, 'value', {
		configurable: false,
		enumerable: true,
		get() {
			const store = getAtomStore();
			if (!store.has(name)) {
				store.set(name, structuredClone(baseValue));
			}
			return store.get(name);
		},
		set(value) {
			const store = getAtomStore();
			store.set(name, value);
		},
	});

	return store;
};
