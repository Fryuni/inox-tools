import { defineConfig } from 'vitest/config';

process.env.NODE_OPTIONS ??= '--enable-source-maps';
process.setSourceMapsEnabled(true);

export default defineConfig({
	test: {
		fileParallelism: false,
		setupFiles: ['./tests/vitest.setup.ts'],
	},
});
