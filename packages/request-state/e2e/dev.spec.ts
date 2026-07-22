import { loadFixture, type DevServer } from '@inox-tools/astro-tests/astroFixture';
import { test, expect } from '@playwright/test';

const fixture = await loadFixture({
	root: './fixture/dev',
});

let server: DevServer;

test.beforeAll(async () => {
	server = await fixture.startDevServer({});
});

test.afterAll(async () => {
	await server?.stop();
	fixture.resetAllFiles();
});

test('apply new as edited during development', async ({ page }) => {
	const pageUrl = fixture.resolveUrl('/');
	const state = page.locator('pre#state');

	await page.goto(pageUrl);
	await expect(state).toHaveText(JSON.stringify({ source: 'Original' }, null, 2));

	await fixture.editFile('./src/state.ts', (code) => (code ?? '').replace('Original', 'Updated'));

	await expect(state).toHaveText(JSON.stringify({ source: 'Updated' }, null, 2));
});
