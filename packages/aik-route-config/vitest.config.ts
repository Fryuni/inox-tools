import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			all: true,
			reportsDirectory: './__coverage__',
			thresholds: {
				autoUpdate: true,
				lines: 51.45,
				functions: 71.42,
				branches: 82.14,
				statements: 51.45,
			},
		},
	},
});
