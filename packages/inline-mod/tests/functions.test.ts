import * as path from 'node:path';
import { expect, test } from 'vitest';
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

test('capturing module', async () => {
	const module = await inspectInlineMod({
		defaultExport: (a: string, b: string) => path.join(a, b),
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    import * as __path from 'path';

    function __f0(__0, __1) {
      return (function() {
        const __vite_ssr_import_2__ = __path;
        return (a, b) => __vite_ssr_import_2__.join(a, b);
      }).apply(undefined, undefined).apply(this, arguments);
    }

    export default __f0;
  `);
});

test('simple classes definition', async () => {
	class Foo {
		public constructor(private value: string) {}
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
		public constructor(private value: string) {}
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
