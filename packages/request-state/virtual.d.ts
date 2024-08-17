declare module '@it-astro:state' {
	export const getState: (key: string, valueIfMissing?: unknown) => unknown;
	export const setState: (key: string, value: unknown) => void;
}

declare global {
	interface DocumentEventMap {
		[ServerStateLoaded.NAME]: import('@inox-tools/request-state/events').ServerStateLoaded;
	}
}
