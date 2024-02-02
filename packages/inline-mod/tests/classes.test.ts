import { expect, test } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

test('simple classes definition', async () => {
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

  const { default: Klass } = (await module.get()) as { default: typeof Foo };

  const instance = new Klass('initial state');

  expect(instance.bar()).toBe('initial state');

  instance.baz('other state');

  expect(instance.bar()).toBe('other state');

  expect(text).toEqualIgnoringWhitespace(`
    function __f0(__0) {
      return (function() {
        return function constructor(value) {
          this.value = value;
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    const __f0_prototype = {};

    const __f1 = function bar() {
      return this.value;
    };

    const __f2 = function baz(value) {
      this.value = value;
    };

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

    export default __f0;
  `);
});

test('simple class instance', async () => {
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
    defaultExport: new Foo('initial state'),
  });

  const { default: instance } = (await module.get()) as { default: Foo };

  expect(instance.bar()).toBe('initial state');

  instance.baz('other state');

  expect(instance.bar()).toBe('other state');

  expect(text).toEqualIgnoringWhitespace(`
    const __defaultExport_proto = {};

    const __f0 = function bar() {
      return this.value;
    };

    const __f1 = function baz(value) {
      this.value = value;
    };

    function __f2(__0) {
      return (function() {
        return function constructor(value) {
          this.value = value;
        };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    Object.defineProperty(__f2, "prototype", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: __defaultExport_proto
    });

    Object.defineProperty(__defaultExport_proto, "bar", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: __f0
    });

    Object.defineProperty(__defaultExport_proto, "baz", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: __f1
    });

    Object.defineProperty(__defaultExport_proto, "constructor", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: __f2
    });

    const __defaultExport = Object.create(__defaultExport_proto);

    __defaultExport.value = "initial state";

    export default __defaultExport;
  `);
});

test('prototype chain', async () => {
  class Parent {
    protected foo(): string {
      return 'from parent';
    }
  }

  class Child extends Parent {
    public foo(): string {
      return `I'm the child, my parent says: ${super.foo()}`;
    }
  }

  const modInfo = await inspectInlineMod({
    constExports: {
      instance: new Child(),
    },
  });

  expect(modInfo.text).toEqualIgnoringWhitespace(`
    const __instance_proto_proto = {};

    const __f0 = function foo() {
      return "from parent";
    };

    function __f1() {
      return (function() {
        return function constructor() { };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    Object.defineProperty(__f1, "prototype", {configurable: false,enumerable: false,writable: false,value: __instance_proto_proto});

    Object.defineProperty(__instance_proto_proto, "foo", {configurable: true,enumerable: false,writable: true,value: __f0});

    Object.defineProperty(__instance_proto_proto, "constructor", {configurable: true,enumerable: false,writable: true,value: __f1});

    const __instance_proto = Object.create(__instance_proto_proto);

    const __f2 = function foo() {
      return \`I'm the child, my parent says: \${super.foo()}\`;
    };

    function __f3() {
      return (function() {
        return function constructor() { super(); };
      }).apply(undefined, undefined).apply(this, arguments);
    }

    Object.defineProperty(__f3, "prototype", {configurable: false,enumerable: false,writable: false,value: __instance_proto});

    Object.defineProperty(__instance_proto, "foo", {configurable: true,enumerable: false,writable: true,value: __f2});

    Object.defineProperty(__instance_proto, "constructor", {configurable: true,enumerable: false,writable: true,value: __f3});

    const __instance = Object.create(__instance_proto);

    export const instance = __instance;
  `);

  const { instance } = await modInfo.module.get() as { instance: Child };

  expect(instance.foo()).toEqual("I'm the child, my parent says: from parent");
})
