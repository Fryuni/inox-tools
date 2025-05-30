import debugC from 'debug';

export const debug = debugC('inox-tools:server-islands');

export const getDebug = (segment?: string) => {
	return segment ? debug.extend(segment) : debug;
};
