import type { ReadableAtom } from 'nanostores';
import { getAllState } from '@it-astro:state';

export const shared = <A extends ReadableAtom<any>>(name: string, store: A): A => {
	const baseValue = store.value;

	Object.defineProperty(store, 'value', {
		configurable: false,
		enumerable: true,
		get() {
			const store = getAllState();
			if (!store.has(name)) {
				store.set(name, structuredClone(baseValue));
			}
			return store.get(name);
		},
		set(value) {
			const store = getAllState();
			store.set(name, value);
		},
	});

	return store;
};
