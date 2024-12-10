import { defineConfig } from 'vite';

process.env.NODE_OPTIONS ??= '--enable-source-maps';
process.setSourceMapsEnabled(true);

export default defineConfig({
	keepProcessEnv: true,
	test: {
		setupFiles: ['./tests/vitest.setup.ts'],
		maxConcurrency: 1,
	},
});
