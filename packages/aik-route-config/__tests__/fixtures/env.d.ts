declare module 'magic:hoist' {
  declare const entrypoint: (input: any) => Promise<void>;

  export default entrypoint;
}
