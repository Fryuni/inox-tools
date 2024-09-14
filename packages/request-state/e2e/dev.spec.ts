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

	await page.goto(pageUrl);
	await expect
		.poll(async () => {
			const state = JSON.parse(await page.locator('pre#state').innerHTML());

			console.log(state);
			return state;
		})
		.toStrictEqual({
			source: 'Original',
		});

	await fixture.editFile('./src/state.ts', (code) => code.replace('Original', 'Updated'));

	await expect
		.poll(async () => JSON.parse(await page.locator('pre#state').innerHTML()))
		.toStrictEqual({
			source: 'Updated',
		});
});
