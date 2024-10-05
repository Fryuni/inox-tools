import { loadFixture } from '@inox-tools/astro-tests/astroFixture';
import { beforeAll, expect, test } from 'vitest';

const fixture = await loadFixture({
	root: './fixture/basic',
});

beforeAll(async () => {
	await fixture.build({});
});

test('elements are sent across Astro Components', async () => {
	const html = await fixture.readFile('header-footer/index.html');

	expect(html).toEqualIgnoringWhitespace(`
<!doctype html>
<html>
  <head>
    <title>Index</title>
  </head>
  <body>
    <header>
      <p>Header</p>
      <p>Header from header</p>
      <p>Header from footer</p>
    </header>
    <footer>
      <p>Footer</p>
      <p>Footer from footer</p>
      <p>Footer from header</p>
    </footer>
  </body>
</html>
`);
});

test('portals entries without a landing portal get voided', async () => {
	const html = await fixture.readFile('missing-portal/index.html');

	expect(html).toEqualIgnoringWhitespace(`
<!doctype html>
<html>
  <head>
    <title>Index</title>
  </head>
  <body>
    <header>
      <p>Header</p>
      <p>Header from header</p>
    </header>
  </body>
</html>
`);
});

test('portal to start and end of identified element', async () => {
	const html = await fixture.readFile('id-boundary/index.html');

	expect(html).toEqualIgnoringWhitespace(`
<!doctype html>
<html>
  <head>
    <title>Index</title>
  </head>
  <body>
    <header>
      <p>Header</p>
    </header>
    <main id="content">
      <p>Prepended from header</p>
      <p>Original</p>
      <p>Appended from header</p>
    </main>
  </body>
</html>
`);
});

test('portal to start and end of head and body', async () => {
	const html = await fixture.readFile('global-boundary/index.html');

	expect(html).toEqualIgnoringWhitespace(`
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="prepended from header">
    <title>Index</title>
    <link rel="stylesheet" href="appended from header">
  </head>
  <body>
    <div>
      <p>Prepended from header</p>
    </div>
    <div>
      <header>
        <p>Header</p>
      </header>
    </div>
    <div>
      <p>Appended from header</p>
    </div>
  </body>
</html>
`);
});
