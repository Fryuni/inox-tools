declare module '@it-astro:state' {
	export const getState: (key: string, valueIfMissing?: unknown) => unknown;
	export const setState: (key: string, value: unknown) => void;

	export { ServerStateLoaded } from './src/events.js';
}

declare global {
	interface DocumentEventMap {
		[ServerStateLoaded.NAME]: import('./src/events.js').ServerStateLoaded;
	}
}
