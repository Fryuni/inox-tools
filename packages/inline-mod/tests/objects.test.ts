import { test, expect } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

test('simple objects', async () => {
  const module = await inspectInlineMod({
    defaultExport: {
      string: 'foo',
      number: 123,
      weirdNumber: NaN,
      boolean: true,
      wellKnownSymbol: Symbol.search,
      ['not an identifier']: 'anything',
      [Symbol.toStringTag]: 'awesome',
    },
  });

  expect(module.text).toEqualIgnoringWhitespace(`
    const __defaultExport = {
      string: "foo",
      number: 123,
      weirdNumber: Number.NaN,
      boolean: true,
      wellKnownSymbol: Symbol.search,
      ["not an identifier"]: "anything",
      [Symbol.toStringTag]: "awesome"
    };

    export default __defaultExport;
  `);
});

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

    const __f0 = () => "read value";

    const __f1 = (value) => console.log(value);

    Object.defineProperty(__defaultExport, "foo", {
      configurable: false,
      enumerable: false,
      get: __f0,
      set: __f1
    });

    export default __defaultExport;
  `);
});

