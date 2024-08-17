declare module '@it-astro:state' {
	export const getState: (key: string, valueIfMissing?: unknown) => unknown;
	export const setState: (key: string, value: unknown) => void;
}
