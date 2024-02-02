import * as path from 'node:path';
import { expect, test } from 'vitest';
import { InspectionError } from '../src/closure/types.js';
import { inspectInlineMod } from '../src/inlining.js';

test('fail to serialzie native objects', async () => {
	await expect(
		inspectInlineMod({
			defaultExport: path.join,
		})
	).rejects.toThrowWithMessage(InspectionError, 'Native code functions cannot be inspected.');
});

test('re-export native module', async () => {
	const module = await inspectInlineMod({
		defaultExport: path,
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    import * as __path from 'path';

    export default __path;
  `);
});

test('re-export native module', async () => {
	const module = await inspectInlineMod({
		defaultExport: path,
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    import * as __path from 'path';

    export default __path;
  `);
});
