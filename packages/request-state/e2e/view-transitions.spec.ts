import { loadFixture, type PreviewServer } from '@inox-tools/astro-tests/astroFixture';
import { test, expect } from '@playwright/test';

const fixture = await loadFixture({
	root: './fixture/view-transitions',
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

test('apply new state after view transition', async ({ page }) => {
	const pageUrl = fixture.resolveUrl('/?name=Emily');

	await page.goto(pageUrl);
	expect(page.locator('#name')).toHaveText('Emily');

	await page.locator('a').click();
	await expect(page).toHaveURL(fixture.resolveUrl('/?name=John'));
	expect(page.locator('#name')).toHaveText('John');
});
