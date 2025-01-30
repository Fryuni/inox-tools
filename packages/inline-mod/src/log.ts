import debug from 'debug';

const baseLogger = debug('inox-tools:im');

export function getLogger(name: string): debug.Debugger {
	return baseLogger.extend(name);
}
