import { atom, computed } from 'nanostores';
import { shared } from '@it-astro:request-nanostores';

export const state = shared('foo', atom<any>(null));

export const serializedState = computed(state, (state) => JSON.stringify(state));
