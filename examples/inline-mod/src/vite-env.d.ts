/// <reference types="vite/client" />

declare module 'virtual:interceptors' {
    export const interceptCounter: (count: number) => number;
}
