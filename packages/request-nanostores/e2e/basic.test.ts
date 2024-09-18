import { loadFixture, type PreviewServer } from '@inox-tools/astro-tests/astroFixture';
import { test, expect } from '@playwright/test';

const fixture = await loadFixture({
	root: './fixture/basic',
});

let server: PreviewServer;

test.beforeAll(async () => {
	delete process.env.INJECTED_STATE;
	await fixture.build({});
	process.env.INJECTED_STATE = JSON.stringify({
		foo: 'bar',
	});
	server = await fixture.preview({});
});

test.afterAll(async () => {
	await server?.stop();
	delete process.env.INJECTED_STATE;
});

test('state is injected from the server on the client', async ({ page }) => {
	await page.goto(fixture.resolveUrl('/'));

	const pageState = JSON.parse(await page.locator('pre#injected-state').innerHTML());

	expect(pageState).toStrictEqual({ foo: 'bar' });
});

test('state is available to UI frameworks in sync with server', async ({ page }) => {
	await page.goto(fixture.resolveUrl('/islands'));

	const serverState = JSON.parse(await page.locator('pre#server').innerHTML());
	const clientState = JSON.parse(await page.locator('pre#client').innerHTML());

	expect(serverState).toStrictEqual(clientState);
});
