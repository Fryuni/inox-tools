import {
	defineConfig,
	devices,
	type Project,
	type PlaywrightWorkerOptions,
} from '@playwright/test';

type Proj = Project<{}, PlaywrightWorkerOptions>;

const browserOptions: Record<string, Proj['use']> = {
	chromium: {
		...devices['Desktop Chrome'],
		launchOptions: {
			executablePath: process.env.PLAYWRIGHT_CHROME_BIN,
		},
	},
	firefox: {
		...devices['Desktop Firefox'],
		launchOptions: {
			executablePath: process.env.PLAYWRIGHT_FIREFOX_BIN,
		},
	},
	webkit: {
		...devices['Desktop Safari'],
		launchOptions: {
			executablePath: process.env.PLAYWRIGHT_WEBKIT_BIN,
		},
	},
};

const browsers: Record<string, Proj> = Object.fromEntries(
	Object.entries(browserOptions).map(([key, value]) => [
		key,
		{
			name: key,
			use: value,
		},
	])
);

const projects: Proj[] = [browsers.chromium];

if (process.env.CI) {
	projects.push(browsers.firefox, browsers.webkit);
} else {
	if (process.env.PLAYWRIGHT_FIREFOX_RUN) {
		projects.push(browsers.firefox);
	}

	if (process.env.PLAYWRIGHT_WEBKIT_RUN) {
		projects.push(browsers.webkit);
	}
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './e2e',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: 'html',
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
	},

	/* Configure projects for major browsers */
	projects: projects,
});
