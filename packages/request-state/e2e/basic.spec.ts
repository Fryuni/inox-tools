import { setTimeout } from 'node:timers/promises';
import { loadFixture, type PreviewServer } from '@inox-tools/astro-tests/astroFixture';
import { test, expect } from '@playwright/test';

const fixture = await loadFixture({
	root: './fixture/basic',
});

let server: PreviewServer;

test.beforeAll(async () => {
	await fixture.build({});
	server = await fixture.preview({});
});

test.afterAll(async () => {
	await server?.stop();
	await server?.closed();
});

test('share state ', async ({ page }) => {
	const pageUrl = fixture.resolveUrl('/?name=John+Doe');

	await page.goto(pageUrl);

	await setTimeout(15000);

	await expect(page.locator('span#name')).toHaveText('John Doe');
});
