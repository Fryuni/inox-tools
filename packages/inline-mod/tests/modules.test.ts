import debugDefault, * as debugStar from 'debug';
import consoleDefault, * as consoleStar from 'node:console';
import { expect, test } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

test('dependency star import', async () => {
	const modInfo = await inspectInlineMod({
		defaultExport: debugStar,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
		import * as __debug from 'debug';

		export default __debug;
	`);
});

test('dependency default import', async () => {
	const modInfo = await inspectInlineMod({
		defaultExport: debugDefault,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
		import __debug from 'debug';

		export default __debug;
	`);
});

test('dependency named import', async () => {
	const modInfo = await inspectInlineMod({
		defaultExport: debugStar.coerce,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
		import {
			coerce as __coerce,
		} from 'debug';

		export default __coerce;
	`);
});

test('native star import', async () => {
	const module = await inspectInlineMod({
		defaultExport: consoleStar,
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    import * as __console from 'console';

    export default __console;
  `);
});

test('native default import', async () => {
	const module = await inspectInlineMod({
		defaultExport: consoleDefault,
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    import __console from 'console';

    export default __console;
  `);
});
