import { defineConfig } from 'vitest/config';

export default defineConfig({
				test: {
								coverage: {
												all: true,
												reportsDirectory: './__coverage__',
												thresholds: {
																autoUpdate: true,
																lines: 53.16,
																functions: 71.42,
																branches: 82.75,
																statements: 53.16,
												},
								},
				},
});