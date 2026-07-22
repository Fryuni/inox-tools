import { defineConfig } from 'vitest/config';

process.env.NODE_OPTIONS ??= '--enable-source-maps';
process.setSourceMapsEnabled(true);

export default defineConfig({
	keepProcessEnv: true,
	test: {
		testTimeout: 30_000,
	},
	dev: {
		sourcemap: true,
	},
	build: {
		sourcemap: 'inline',
	},
});
