import { loadFixture, type TestApp } from '@inox-tools/astro-tests/astroFixture';
import testAdapter from '@inox-tools/astro-tests/testAdapter';
import { beforeAll } from 'vitest';
import { defineCommonTests } from './common.js';

const fixture = await loadFixture({
	root: './fixture/basic',
	outDir: 'dist/server',
	output: 'server',
	adapter: testAdapter(),
});

let app: TestApp;

beforeAll(async () => {
	await fixture.build({});
	app = await fixture.loadTestAdapterApp();
});

defineCommonTests(async (path) => {
	const res = await app.render(new Request(`http://example.com/${path}`));
	return res.text();
});
