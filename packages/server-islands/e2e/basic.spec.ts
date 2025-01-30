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

test('identify when the component is being used directly on a page', async ({ page }) => {
	const pageUrl = fixture.resolveUrl('/inline-component');
	await page.goto(pageUrl);

	await expect(page.locator('css=#is-island')).toHaveText('false');
	await expect(page.locator('css=#island-context-url')).toHaveText('');
	await expect(page.locator('css=#astro-url')).toHaveText(pageUrl);
	await expect(page.locator('css=#page-url')).toHaveText(pageUrl);
});

test('identify when the component is being used on a server island', async ({ page }) => {
	const pageUrl = fixture.resolveUrl('/island-component');
	await page.goto(pageUrl);

	await expect(page.locator('css=#is-island')).toHaveText('true');
	await expect(page.locator('css=#island-context-url')).toHaveText(pageUrl);
	await expect(page.locator('css=#astro-url')).not.toHaveText(pageUrl);
	await expect(page.locator('css=#page-url')).toHaveText(pageUrl);
});
