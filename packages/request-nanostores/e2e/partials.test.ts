import {
	loadFixture,
	type DevServer,
	type PreviewServer,
} from '@inox-tools/astro-tests/astroFixture';
import { test, expect } from '@playwright/test';

interface partialServerConfig {
	name: string;
	port: number;
}

const partialServerConfigs: partialServerConfig[] = [
	{ name: 'foo-first', port: 4000 },
	{ name: 'foo-second', port: 4001 },
	{ name: 'bar', port: 4002 },
];

const partialsProxyFixture = await loadFixture({ root: './fixture/partials/proxy' });

let partialServers: DevServer[];
let proxyServer: PreviewServer;

test.beforeAll(async () => {
	partialServers = await Promise.all(
		partialServerConfigs.map(async ({ name, port }) => {
			const fixture = await loadFixture({ root: `./fixture/partials/${name}` });
			return fixture.startDevServer({ server: { port } });
		})
	);
	await partialsProxyFixture.build({});
	proxyServer = await partialsProxyFixture.preview({});
});

test.afterAll(async () => {
	await proxyServer?.stop();
	await Promise.all(partialServers.map((server) => server.stop()));
});

test('can collect partials from other servers', async ({ page }) => {
	await page.goto(partialsProxyFixture.resolveUrl('/'));

	const fooFirstState = JSON.parse(await page.locator('pre#injected-state-foo-first').innerHTML());
	const fooSecondState = JSON.parse(
		await page.locator('pre#injected-state-foo-second').innerHTML()
	);
	const barState = JSON.parse(await page.locator('pre#injected-state-bar').innerHTML());

	expect(fooFirstState).toBe('foo-first');
	expect(fooSecondState).toBe('foo-first'); // not a mistake - when a partial tries to overwrite an existing partial, it should fail
	expect(barState).toBe('bar');
});
