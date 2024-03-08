import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { transform } from '@astrojs/compiler';

const fixtureFolder = fileURLToPath(new URL('./fixtures', import.meta.url));

export async function loadAstroFixture(name: string) {
  const fixturePath = join(fixtureFolder, `${name}.astro`);

  const astroSrc = await readFile(fixturePath, 'utf-8');

  const result = await transform(astroSrc);

  return result.code;
}
