import type { Entry } from './closure/entry.js';

/** @internal */
export const logger = new console.Console({
	stdout: process.stdout,
	stderr: process.stderr,
	colorMode: 'auto',
	inspectOptions: {
		depth: 4,
		showHidden: true,
		showProxy: true,
		compact: 3,
		breakLength: 80,
		sorted: true,
		getters: false,
	},
});

/** @internal */
export const modRegistry = new Map<string, Promise<ModEntry>>();
