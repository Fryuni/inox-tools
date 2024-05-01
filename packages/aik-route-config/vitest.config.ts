import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			all: true,
			reportsDirectory: './__coverage__',
			thresholds: {
				autoUpdate: true,
				lines: 50,
				functions: 69.23,
				branches: 87.75,
				statements: 50,
			},
		},
	},
});
