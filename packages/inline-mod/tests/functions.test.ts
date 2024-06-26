import { expect, test } from 'vitest';
import { magicFactory } from '../src/closure/inspectCode.js';
import { inspectInlineMod } from '../src/inlining.js';

test('arrow function', async () => {
	const module = await inspectInlineMod({
		defaultExport: (value: string) => value + 'foo',
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    const __f0 = (value) => value + "foo";

    export default __f0;
  `);
});

test('capturing object', async () => {
	const suffixes: Partial<Record<string, string>> = {
		foo: 'bar',
		baz: 'qux',
	};

	const module = await inspectInlineMod({
		defaultExport: (value: string) => value + (suffixes[value] ?? ''),
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    const __suffixes = {foo: "bar", baz: "qux"};
    function __f0(__0) {
      return (function() {
        const suffixes = __suffixes;
        return (value) => value + (suffixes[value] ?? "");
      }).apply(undefined, undefined).apply(this, arguments);
    }

    export default __f0;
  `);
});

test.skip('partially capturing object', async () => {
	const suffixes = {
		foo: 'bar',
		baz: 'qux',
	};

	const module = await inspectInlineMod({
		defaultExport: (value: string) => value + suffixes.foo,
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    const __suffixes = {foo: "bar"};
    function __f0(__0) {
      return (function() {
        const suffixes = __suffixes;
        return (value) => value + suffixes.foo;
      }).apply(undefined, undefined).apply(this, arguments);
    }

    export default __f0;
  `);
});

test('recurring function', async () => {
	function f(n: number): number {
		return n < 0 ? n : f(n - 1);
	}

	const modInfo = await inspectInlineMod({
		defaultExport: f,
	});

	expect(modInfo.text).toEqualIgnoringWhitespace(`
    function __f(__0) {
      return (function() {
        const f = __f;
        return function f(n) {
          return n < 0 ? n : f(n - 1);
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    export default __f;
  `);
});
