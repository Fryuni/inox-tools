declare module '@it-astro:state' {
	export const getState: (key: string) => unknown | undefined;
	export const setState: (key: string, value: unknown) => void;
}
