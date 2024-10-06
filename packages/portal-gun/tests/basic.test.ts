import { loadFixture } from '@inox-tools/astro-tests/astroFixture';
import { beforeAll } from 'vitest';
import { defineCommonTests } from './common.js';

const fixture = await loadFixture({
	root: './fixture/basic',
	outDir: 'dist/static',
});

beforeAll(async () => {
	await fixture.build({});
});

defineCommonTests((path) => fixture.readFile(`${path}/index.html`));
