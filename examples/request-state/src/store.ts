import { shared } from '@it-astro:request-nanostores';
import { atom } from 'nanostores';

export const $renderTimeMsg = shared('store', atom<string>('Render time unset'));
