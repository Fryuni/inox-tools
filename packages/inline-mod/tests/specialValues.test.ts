import { expect, test } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';
import { asyncFactory, factory, lazyValue } from '../src/index.js';

test('factory values', async () => {
	let callCount = 0;

	const factoryValue = factory(() => {
		callCount++;

		return {
			value: 'foo',
		};
	});

	const modInfo = await inspectInlineMod({
		defaultExport: factoryValue,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    function __f0() {
      return (function() {
        const callCount = 0;
        return () => {
          callCount++;
          return {
            value: "foo"
          };
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    const __defaultExport = __f0();

    export default __defaultExport;
  `);

	expect(callCount).toBe(0);

	expect(factoryValue.value).toEqual('foo');

	expect(callCount).toBe(1);

	factoryValue.value = 'bar';
	expect(factoryValue.value).toEqual('bar');

	expect(callCount).toBe(1);
});

test('async factory values', async () => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used to test serialization
	let callCount = 0;

	const factoryValue = asyncFactory(() => {
		callCount++;

		return Promise.resolve({
			value: 'foo',
		});
	});

	const modInfo = await inspectInlineMod({
		defaultExport: factoryValue,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    function __f0() {
      return (function() {
        const callCount = 0;
        return () => {
          callCount++;
          return Promise.resolve({
            value: "foo"
          });
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    const __defaultExport = await __f0();

    export default __defaultExport;
  `);
});

test('lazy values', async () => {
	const value = lazyValue<string>();

	setTimeout(() => {
		value.resolve('foo');
	}, 500);

	const modInfo = await inspectInlineMod({
		defaultExport: value,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    export default "foo";
  `);
});
