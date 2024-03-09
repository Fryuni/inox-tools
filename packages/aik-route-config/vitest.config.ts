import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			all: true,
			reportsDirectory: './__coverage__',
			thresholds: {
				autoUpdate: true,
				lines: 51.35,
				functions: 73.33,
				branches: 90.19,
				statements: 51.35,
			},
		},
	},
});
