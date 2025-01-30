import { defineConfig } from 'vite';

export default defineConfig({
	test: {
		include: ['tests/**/*.{test,spec}.{ts,mts,cts}'],
		setupFiles: ['./tests/vitest.setup.ts'],
		maxConcurrency: 1,
	},
});
