import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  bundle: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  minify: true,
  external: [],
  noExternal: ['@lunariajs/core'],
  treeshake: 'smallest',
  tsconfig: 'tsconfig.json',
});
