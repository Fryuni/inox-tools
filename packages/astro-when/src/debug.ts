import debugC from 'debug';

export const debug = debugC('inox-tools:astro-when');

export const getDebug = (name?: string) => (name ? debug.extend(name) : debug);
