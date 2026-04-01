import { defineConfig } from 'vite';

export default defineConfig({
	test: {
		setupFiles: ['./tests/vitest.setup.ts'],
		testTimeout: 30_000,
		fileParallelism: false,
	},
});
