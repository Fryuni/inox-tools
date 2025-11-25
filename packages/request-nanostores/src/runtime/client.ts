import { onMount, type ReadableAtom } from 'nanostores';
import { getAllState } from '@it-astro:state';

const storesToNotify: Array<ReadableAtom<any>> = [];

const STATE_NAMESPACE = '@inox-tools/request-nanostores:';

export const shared = <A extends ReadableAtom<any>>(name: string, store: A): A => {
	const baseValue = store.value;

	Object.defineProperty(store, 'value', {
		configurable: false,
		enumerable: true,
		get() {
			const store = getAllState();
			if (!store.has(STATE_NAMESPACE + name)) {
				store.set(STATE_NAMESPACE + name, structuredClone(baseValue));
			}
			return store.get(STATE_NAMESPACE + name);
		},
		set(value) {
			const store = getAllState();
			store.set(STATE_NAMESPACE + name, value);
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
