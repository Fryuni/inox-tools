import { expect, test } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

test('generator function', async () => {
	function* gen() {
		const a = [1, 2, 3];

		for (const b of a) {
			yield b;
		}
	}

	const modInfo = await inspectInlineMod({
		defaultExport: gen,
	});

	const { default: generator } = (await modInfo.module.get()) as { default: typeof gen };

	const values = Array.from(generator());

	expect(values).toEqual([1, 2, 3]);

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    function __gen() {
      return (function() {
        const __super = Object.getPrototypeOf(function*(){});
        const gen = __gen;
        return function* /*gen*/() {
            const a = [1, 2, 3];
            for (const b of a) {
                yield b;
            }
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    Object.setPrototypeOf(__gen, Object.getPrototypeOf(function*(){}));

    const __gen_prototype = Object.create(Object.getPrototypeOf((function*(){}).prototype));

    Object.defineProperty(__gen, "prototype", {configurable: false,enumerable: false,writable: true,value: __gen_prototype});

    export default __gen;
  `);
});

test('async function', async () => {
	async function fn() {
		return 'some text';
	}

	const modInfo = await inspectInlineMod({
		defaultExport: fn,
	});

	const { default: modFn } = (await modInfo.module.get()) as { default: typeof fn };

	const value = modFn();

	expect(value).toBeInstanceOf(Promise);
	await expect(value).resolves.toEqual('some text');

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    function __fn() {
      return (function() {
        const fn = __fn;
        return async function fn() {
          return "some text";
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    export default __fn;
  `);
});
