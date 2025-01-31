import { atom } from 'nanostores';
import { shared } from '@it-astro:request-nanostores';

export const identifier = shared('identifier', atom<number>(0));
