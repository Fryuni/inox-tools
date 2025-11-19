import { onMount, type ReadableAtom } from 'nanostores';
import { getAllState } from '@it-astro:state';

const storesToNotify: Array<ReadableAtom<any>> = [];

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

	onMount(store, () => {
		storesToNotify.push(store);
		return () => {
			storesToNotify.splice(storesToNotify.indexOf(store), 1);
		};
	});

	return store;
};

document.addEventListener('astro:page-load', () => {
	for (const store of storesToNotify) {
		store.notify();
	}
});
