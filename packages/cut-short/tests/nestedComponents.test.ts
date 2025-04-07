import { loadFixture, type TestApp } from '@inox-tools/astro-tests/astroFixture';
import testAdapter from '@inox-tools/astro-tests/testAdapter';
import { beforeAll, expect, test } from 'vitest';

const fixture = await loadFixture({
	root: './fixture/nestedComponents/',
	output: 'server',
	adapter: testAdapter(),
});

let app: TestApp;

beforeAll(async () => {
	await fixture.build({});
	app = await fixture.loadTestAdapterApp();
});

test('ending request on page frontmatter', async () => {
	const res = await app.render(new Request('https://example.com/'));

	expect(res.headers.get('Content-Type')).toEqual('application/json');

	const content = await res.json();
	expect(content).toEqual({ cutShort: true, from: 'index page' });
});

test('ending request on nested component frontmatter', async () => {
	const res = await app.render(new Request('https://example.com/end-from-component'));

	expect(res.headers.get('Content-Type')).toEqual('application/json');

	const content = await res.json();
	expect(content).toEqual({ cutShort: true, from: 'EndRequest component' });
});

test('ending request by returning a response from a component', async () => {
	const res = await app.render(new Request('https://example.com/return-from-component'));

	expect(res.headers.get('Content-Type')).toEqual('application/json');

	const content = await res.json();
	expect(content).toEqual({ cutShort: true, from: 'ReturnResponse component' });
});

test('ending request with a component failure', async () => {
	const res = await app.render(new Request('https://example.com/component-error'));

	expect(res.status).toBe(500);
	expect(res.headers.get('Content-Type')).toEqual('text/html');

	const content = await res.text();
	expect(content).toEqual(
		'<!DOCTYPE html><html> <head><title>Its broken</title></head> <body> <p>This is my custom error 500 page!</p> </body></html>'
	);
});

test('completing request with headers set from component', async () => {
	const res = await app.render(new Request('https://example.com/component-header'));

	expect(res.headers.get('Content-Type')).toEqual('text/html');

	// Header from component
	expect(res.headers.get('foo')).toEqual('bar');

	// Cookies from component
	const cookieHeaders = Array.from(app.toInternalApp().setCookieHeaders(res));
	expect(cookieHeaders).toEqual(['bar=deleted; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'foo=bar']);

	const content = await res.text();
	expect(content).toEqual('');
});
