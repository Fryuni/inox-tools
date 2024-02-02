import debug from 'debug';

debug.inspectOpts = {
	colors: true,
	depth: null,
};

const baseLogger = debug('inox-tools:im');

export function getLogger(name: string): debug.Debugger {
	return baseLogger.extend(name);
}
