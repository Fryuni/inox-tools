import { expect, test } from 'vitest';
import { SerializationError } from '../src/closure/types.js';
import { inspectInlineMod } from '../src/inlining.js';

test('const exports', async () => {
	const modInfo = await inspectInlineMod({
		constExports: {
			foo: 'something',
			bar: [],
		},
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    const __bar = [];

    export const foo = "something";
    export const bar = __bar;
  `);
});

test('invalid identifier const exports', async () => {
	const modInfo = inspectInlineMod({
		constExports: {
			'not an identifier': 'foo',
		},
	});

	await expect(modInfo).rejects.toThrowWithMessage(
		SerializationError,
		'Exported const cannot have name "not an identifier", use assign export for that.'
	);
});

test('default export', async () => {
	const modInfo = await inspectInlineMod({
		defaultExport: {
			foo: 'something',
			bar: [],
		},
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    const __defaultExport = {};
    const __defaultExport_bar = [];

    __defaultExport.foo = "something";
    __defaultExport.bar = __defaultExport_bar;

    export default __defaultExport;
  `);
});

test('assign exports', async () => {
	const modInfo = await inspectInlineMod({
		assignExports: {
			foo: 'something',
			bar: [],
			'not an identifier': 123,
		},
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    const __foo = "something";
    const __bar = [];
    const __notanidentifier = 123;

    export {
      __foo as "foo",
      __bar as "bar",
      __notanidentifier as "not an identifier",
    };
  `);

	const mod = (await modInfo.module.get()) as Record<string, unknown>;

	expect({ ...mod }).toStrictEqual({
		foo: 'something',
		bar: [],
		'not an identifier': 123,
	});
});
