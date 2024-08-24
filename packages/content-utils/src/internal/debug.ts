import debugC from 'debug';

export const debug = debugC('inox-tools:content-utils');

export const getDebug = (name?: string) => (name === undefined ? debug : debug.extend(name));
