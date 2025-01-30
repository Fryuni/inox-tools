import { expect, test } from 'vitest';

export const defineCommonTests = (loadPath: (path: string) => Promise<string>) => {
	test('elements are sent across Astro Components', async () => {
		const html = await loadPath('header-footer');

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
		const html = await loadPath('missing-portal');

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
		const html = await loadPath('id-boundary');

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
		const html = await loadPath('global-boundary');

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

	test('portal entries from within UI framework component', async () => {
		const html = await loadPath('ui-frameworks');

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

	test('portals can go through portals', async () => {
		const html = await loadPath('nested-portals');

		expect(html).toEqualIgnoringWhitespace(`
<!doctype html>
<html>
  <head>
    <title>Index</title>
  </head>
  <body>
    <header id="header">
      <p>two jumps</p>
    </header>
    <p>portal out of portal</p>
    <footer>
			<!-- Duplicating portal -->
      <p>two jumps</p>
    </footer>
  </body>
</html>
`);
	});
};
