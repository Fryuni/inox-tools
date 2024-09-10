import { loadFixture, type DevServer } from '@inox-tools/astro-tests/astroFixture';
import testAdapter from '@inox-tools/astro-tests/testAdapter';
import type { App } from 'astro/app';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const fixture = await loadFixture({
	root: './fixture/server-output',
	adapter: testAdapter(),
});

describe('Astro when on a static output project', () => {
	describe('dev server', () => {
		let devServer: DevServer;

		beforeAll(async () => {
			await fixture.startDevServer({});
		});

		afterAll(async () => {
			devServer?.stop();
		});

		test('identifies the dev server for prerender routes', async () => {
			const res = await fixture.fetch('/prerendered');
			const content = await res.text();

			expect(content).toEqual('devServer');
		});

		test('identifies the dev server for on-demand routes', async () => {
			const res = await fixture.fetch('/on-demand');
			const content = await res.text();

			expect(content).toEqual('devServer');
		});
	});

	describe('build output', () => {
		let app: App;

		beforeAll(async () => {
			await fixture.build({});
			app = await fixture.loadTestAdapterApp();
		});

		test('identifies the prerender stage', async () => {
			const res = await app.render(new Request('http://example.com/prerendered'));
			const content = await res.text();

			expect(content).toEqual('prerender');
		});

		test('identifies the server stage', async () => {
			const res = await app.render(new Request('http://example.com/on-demand'));
			const content = await res.text();

			expect(content).toEqual('server');
		});
	});
});
