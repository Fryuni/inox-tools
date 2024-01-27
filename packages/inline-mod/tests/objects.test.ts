import { test, expect } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

test('nested objects', async () => {
  const module = await inspectInlineMod({
    defaultExport: {
      foo: 'bar',
      obj: {
        baz: 'qux',
      },
    },
  });

  expect(module.text).toEqualIgnoringWhitespace(`
    const __defaultExport = {};
    const __defaultExport_obj = {baz: "qux"};
    __defaultExport.foo = "bar";
    __defaultExport.obj = __defaultExport_obj;

    export default __defaultExport;
  `);
});

test.skip('circular object', async () => {
  const obj: Record<string, unknown> = {};
  obj.self = obj;

  const module = await inspectInlineMod({
    defaultExport: obj,
  });

  expect(module.text).toEqualIgnoringWhitespace(`
    const __defaultExport_1 = [];
    __defaultExport_1[0] = 123;
    __defaultExport_1[1] = __defaultExport_1;

    export default __defaultExport;
  `);
});

test('objects with custom property descriptors', async () => {
  const obj = {};

  Object.defineProperty(obj, 'foo', {
    value: 'bar',
    enumerable: false,
    writable: false,
    configurable: false,
  });

  const module = await inspectInlineMod({
    defaultExport: obj,
  });

  expect(module.text).toEqualIgnoringWhitespace(`
    const __defaultExport = {};

    Object.defineProperty(__defaultExport, "foo", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: "bar"
    });

    export default __defaultExport;
  `);
});

test('objects with custom getter and setter', async () => {
  const obj = {};

  Object.defineProperty(obj, 'foo', {
    get: () => 'read value',
    // eslint-disable-next-line no-console -- Simple statement for the test
    set: value => console.log(value),
  });

  const module = await inspectInlineMod({
    defaultExport: obj,
  });

  expect(module.text).toEqualIgnoringWhitespace(`
    const __defaultExport = {};

    function __f0() {
      return (function() {
        return () => "read value";
      }).apply(undefined, undefined).apply(this, arguments);
    }

    function __f1(__0) {
      return (function() {
        return (value) => console.log(value);
      }).apply(undefined, undefined).apply(this, arguments);
    }

    Object.defineProperty(__defaultExport, "foo", {
      configurable: false,
      enumerable: false,
      get: __f0,
      set: __f1
    });

    export default __defaultExport;
  `);
});

