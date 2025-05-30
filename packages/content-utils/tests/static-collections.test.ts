import { loadFixture } from '@inox-tools/astro-tests/astroFixture';
import testAdapter from '@inox-tools/astro-tests/testAdapter';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const fixture = await loadFixture({
	root: './fixture/static-collections',
});

describe('Static output sites', () => {
	beforeAll(async () => {
		await fixture.clean();
		fixture.resetAllFiles();
	});

	afterEach(() => {
		fixture.resetAllFiles();
	});

	it('builds statically without error', async () => {
		await fixture.build({});

		expect(await fixture.readFile('prerender/static/index.html')).toEqual(
			'<p>static-1: This is available only on build time</p>'
		);

		expect(await fixture.readFile('prerender/dynamic/index.html')).toEqual(
			'<p>dynamic-1: This is available on build time and server time</p>'
		);
	});

	it.skip('keeps the full erasure from Astro when no collection is needed on the server', async () => {
		await fixture.build({
			adapter: testAdapter(),
		});

		const staticContent = await fixture.readFile('client/prerender/static/index.html');

		expect(staticContent).toEqual('<p>static-1: This is available only on build time</p>');

		const dynamicContent = await fixture.readFile('client/prerender/dynamic/index.html');

		expect(dynamicContent).toEqual(
			'<p>dynamic-1: This is available on build time and server time</p>'
		);

		const [chunkPath] = await fixture.glob('server/chunks/_astro_data-layer-content*.mjs');
		const chunkContent = await fixture.readFile(chunkPath);

		expect(chunkContent).not.toInclude('export');
	});

	it('erase static only content from the server build', async () => {
		const staticSrc = await fixture.readSrcFile('src/pages/prerender/static.astro');
		const dynamicSrc = await fixture.readSrcFile('src/pages/prerender/dynamic.astro');

		await fixture.editFile(
			'src/pages/on-demand/static.astro',
			staticSrc!.replace('prerender = true', 'prerender = false')
		);
		await fixture.editFile(
			'src/pages/on-demand/dynamic.astro',
			dynamicSrc!.replace('prerender = true', 'prerender = false')
		);

		await fixture.build({
			adapter: testAdapter(),
		});

		const staticContent = await fixture.readFile('client/prerender/static/index.html');

		expect(staticContent).toEqual('<p>static-1: This is available only on build time</p>');

		const dynamicContent = await fixture.readFile('client/prerender/dynamic/index.html');

		expect(dynamicContent).toEqual(
			'<p>dynamic-1: This is available on build time and server time</p>'
		);

		const [chunkPath] = await fixture.glob('server/chunks/_astro_data-layer-content*.mjs');
		const chunkContent = await fixture.readFile(chunkPath);

		expect(chunkContent).toInclude('export');

		const app = await fixture.loadTestAdapterApp();

		const staticRes = await app.render(new Request('https://example.com/on-demand/static'));

		expect(await staticRes.text()).toEqual('');

		const dynamicRes = await app.render(new Request('https://example.com/on-demand/dynamic'));

		expect(await dynamicRes.text()).toEqual(
			'<p>dynamic-1: This is available on build time and server time</p>'
		);
	});
});
