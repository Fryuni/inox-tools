import { loadFixture } from '@inox-tools/astro-tests/astroFixture';
import testAdapter from '@inox-tools/astro-tests/testAdapter';
import { beforeAll, expect, test } from 'vitest';

const fixture = await loadFixture({
	root: './fixture/ssr-callbacks',
	output: 'server',
	adapter: testAdapter(),
});

beforeAll(async () => {
	await fixture.clean();
	await fixture.build({});
});

test('includes URLs added by SSR sitemap callbacks in pure server output', async () => {
	const sitemap = await fixture.readFile('client/sitemap-0.xml');

	expect(sitemap).not.toBeNull();
	expect(sitemap).toContain('<loc>https://example.com/posts/post-1</loc>');
	expect(sitemap).toContain('<loc>https://example.com/posts/post-2</loc>');
	expect(sitemap).toContain('<loc>https://example.com/posts/post-3</loc>');
});
