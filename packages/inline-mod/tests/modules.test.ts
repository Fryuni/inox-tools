import debug from 'debug';
import consoleDefault, * as consoleStar from 'node:console';
import { expect, test } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

// test('dependency star import', async () => {
// 	const modInfo = await inspectInlineMod({
// 		defaultExport: starPMap,
// 	});
//
// 	expect(modInfo.text).toEqualIgnoringWhitespace(`
// 		import * as __debug from 'debug';
//
// 		export default __debug;
// 	`);
// });

test('CJS dependency default import', async () => {
	const modInfo = await inspectInlineMod({
		defaultExport: debug,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
		import __node_modulespnpmdebug437node_modulesdebugsrcindexjs from './../../node_modules/.pnpm/debug@4.3.7/node_modules/debug/src/index.js';

		export default __node_modulespnpmdebug437node_modulesdebugsrcindexjs;
	`);
});

test('CJS dependency named import', async () => {
	const modInfo = await inspectInlineMod({
		defaultExport: debug.coerce,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
		import {
			coerce as __coerce,
		} from './../../node_modules/.pnpm/debug@4.3.7/node_modules/debug/src/index.js';

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
