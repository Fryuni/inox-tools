import { loadFixture, type DevServer } from '@inox-tools/astro-tests/astroFixture';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const fixture = await loadFixture({
  root: './fixture/static-output',
});

describe('Astro when on a static output project', () => {
  describe('dev server', () => {
    let devServer: DevServer;

    beforeAll(async () => {
      await fixture.startDevServer({});
    });

    afterAll(async () => {
      devServer?.stop();
    })

    test('identifies the dev server', async () => {
      const res = await fixture.fetch('/');
      const content = await res.text();

      expect(content).toEqual('devServer');
    })
  });

  describe('build time', () => {
    beforeAll(async () => {
      await fixture.build({});
    });

    test('identifies the static build stage', async () => {
      const content = await fixture.readFile('index.html');

      expect(content).toEqual('staticBuild');
    })
  });
})
