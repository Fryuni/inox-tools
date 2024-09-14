import debugC from 'debug';

debugC.inspectOpts = {
	colors: true,
	depth: null,
};

export const debug = debugC('inox-tools:astro-tests');

export function getDebug(name: string): debugC.Debugger {
	return debug.extend(name);
}