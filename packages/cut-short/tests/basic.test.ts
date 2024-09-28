import { loadFixture, type TestApp } from '@inox-tools/astro-tests/astroFixture';
import testAdapter from '@inox-tools/astro-tests/testAdapter';
import { beforeAll, expect, test } from 'vitest';

const fixture = await loadFixture({
  root: './fixture/basic',
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
  expect(content).toEqual({ cutShort: true });
});
