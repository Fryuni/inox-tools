import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    setupFiles: ['./tests/vitest.setup.ts'],
  },
});
