import { test, expect } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';
import * as path from 'node:path';

test('arrow function', async () => {
  const module = await inspectInlineMod({
    defaultExport: (value: string) => value + 'foo',
  });

  expect(module.text).toEqualIgnoringWhitespace(`
    function __f0(__0) {
      return (function() {
        return (value) => value + "foo";
      }).apply(undefined, undefined).apply(this, arguments);
    }

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

test('capturing module', async () => {
  const module = await inspectInlineMod({
    defaultExport: (a: string, b: string) => path.join(a, b),
  });

  expect(module.text).toEqualIgnoringWhitespace(`
    import * as __vite_ssr_import_2__0 from 'path';

    function __f0(__0, __1) {
      return (function() {
        const __vite_ssr_import_2__ = __vite_ssr_import_2__0;
        return (a, b) => __vite_ssr_import_2__.join(a, b);
      }).apply(undefined, undefined).apply(this, arguments);
    }

    export default __f0;
  `);
});

test('simple classes', async () => {
  class Foo {
    public constructor(private value: string) { }
    public bar() {
      return this.value;
    }
    public baz(value: string) {
      this.value = value;
    }
  }

  const { module, text } = await inspectInlineMod({
    defaultExport: Foo,
  });

  const { default: Klass } = await module.get() as { default: typeof Foo };

  const instance = new Klass('initial state');

  expect(instance.bar()).toBe('initial state');

  instance.baz('other state');

  expect(instance.bar()).toBe('other state');

  expect(text).toEqualIgnoringWhitespace(`
    const __f0_prototype = {};

    function __f1() {
      return (function() {
        return function /*bar*/() {
          return this.value;
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    function __f2(__0) {
      return (function() {
        return function /*baz*/(value) {
          this.value = value;
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    Object.defineProperty(__f0_prototype, "constructor", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: __f0
    });

    Object.defineProperty(__f0_prototype, "bar", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: __f1
    });

    Object.defineProperty(__f0_prototype, "baz", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: __f2
    });

    Object.defineProperty(__f0, "prototype", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: __f0_prototype
    });

    function __f0(__0) {
      return (function() {
        return function /*constructor*/(value) {
          this.value = value;
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    export default __f0;
  `);
});

