import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			all: true,
			reportsDirectory: './__coverage__',
			thresholds: {
				autoUpdate: true,
				lines: 52.85,
				functions: 71.42,
				branches: 82.75,
				statements: 52.85,
			},
		},
	},
});
