import { describe, expect, test, vi } from 'vitest';
import { Lazy, LazyKeyed } from '../src/lazy.js';

describe('Lazy', () => {
	describe('Lazy.of', () => {
		test('the factory is not called if the value is not read', () => {
			const factory = vi.fn();

			Lazy.of(factory);

			expect(factory).not.toBeCalled();
		});

		test('the factory is called on first get()', () => {
			const factory = vi.fn(() => 42);
			const lazy = Lazy.of(factory);

			const result = lazy.get();

			expect(factory).toBeCalledTimes(1);
			expect(result).toBe(42);
		});

		test('the factory is only called once on multiple get() calls', () => {
			const factory = vi.fn(() => 'value');
			const lazy = Lazy.of(factory);

			lazy.get();
			lazy.get();
			lazy.get();

			expect(factory).toBeCalledTimes(1);
		});

		test('returns the same instance on multiple get() calls', () => {
			const obj = { key: 'value' };
			const lazy = Lazy.of(() => obj);

			expect(lazy.get()).toBe(obj);
			expect(lazy.get()).toBe(obj);
		});
	});

	describe('Lazy.wrap', () => {
		test('returns a function that lazily computes the value', () => {
			const factory = vi.fn(() => 123);
			const wrapped = Lazy.wrap(factory);

			expect(factory).not.toBeCalled();

			const result = wrapped();

			expect(factory).toBeCalledTimes(1);
			expect(result).toBe(123);
		});

		test('wrapped function returns the same value on multiple calls', () => {
			const factory = vi.fn(() => ({ data: 'test' }));
			const wrapped = Lazy.wrap(factory);

			const first = wrapped();
			const second = wrapped();

			expect(factory).toBeCalledTimes(1);
			expect(first).toBe(second);
		});
	});

	describe('circular dependency detection', () => {
		test('throws an error when circular dependency is detected', () => {
			let lazy: Lazy<number>;
			lazy = Lazy.of(() => {
				return lazy.get() + 1;
			});

			expect(() => lazy.get()).toThrow('Circular dependency detected during Lazy value creation.');
		});

		test('subsequent get() calls also throw after circular dependency', () => {
			let lazy: Lazy<number>;
			lazy = Lazy.of(() => {
				return lazy.get() + 1;
			});

			expect(() => lazy.get()).toThrow();
			expect(() => lazy.get()).toThrow('Circular dependency detected during Lazy value creation.');
		});
	});

	describe('Promise interface', () => {
		test('can be awaited with then()', async () => {
			const lazy = Lazy.of(() => 'async value');

			const result = await lazy.then((v) => v.toUpperCase());

			expect(result).toBe('ASYNC VALUE');
		});

		test('can be awaited directly', async () => {
			const lazy = Lazy.of(() => 42);

			const result = await lazy;

			expect(result).toBe(42);
		});

		test('catch() handles errors from factory', async () => {
			const lazy = Lazy.of(() => {
				throw new Error('factory error');
			});

			const result = await lazy.catch((e) => e.message);

			expect(result).toBe('factory error');
		});

		test('finally() is called after resolution', async () => {
			const finallyFn = vi.fn();
			const lazy = Lazy.of(() => 'value');

			await lazy.finally(finallyFn);

			expect(finallyFn).toBeCalledTimes(1);
		});

		test('finally() is called after rejection', async () => {
			const finallyFn = vi.fn();
			const lazy = Lazy.of(() => {
				throw new Error('error');
			});

			await lazy.catch(() => {}).finally(finallyFn);

			expect(finallyFn).toBeCalledTimes(1);
		});

		test('has correct Symbol.toStringTag', () => {
			const lazy = Lazy.of(() => 1);

			expect(Object.prototype.toString.call(lazy)).toBe('[object Lazy]');
		});
	});

	describe('attach()', () => {
		test('callback is called when value is computed', () => {
			const callback = vi.fn();
			const lazy = Lazy.of(() => 'test');

			lazy.attach(callback);
			expect(callback).not.toBeCalled();

			lazy.get();

			expect(callback).toBeCalledTimes(1);
			expect(callback).toBeCalledWith('test');
		});

		test('callback is called immediately if value already exists', () => {
			const lazy = Lazy.of(() => 'existing');
			lazy.get();

			const callback = vi.fn();
			lazy.attach(callback);

			expect(callback).toBeCalledTimes(1);
			expect(callback).toBeCalledWith('existing');
		});

		test('multiple callbacks are all invoked', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const lazy = Lazy.of(() => 100);

			lazy.attach(callback1);
			lazy.attach(callback2);
			lazy.get();

			expect(callback1).toBeCalledWith(100);
			expect(callback2).toBeCalledWith(100);
		});

		test('returns this for chaining', () => {
			const lazy = Lazy.of(() => 1);

			const result = lazy.attach(() => {});

			expect(result).toBe(lazy);
		});
	});

	describe('chain()', () => {
		test('creates a new Lazy with transformed value', () => {
			const lazy = Lazy.of(() => 5);
			const chained = lazy.chain((v) => v * 2);

			expect(chained.get()).toBe(10);
		});

		test('chained Lazy is evaluated when source is evaluated', () => {
			const chainedFactory = vi.fn((v: number) => v + 1);
			const lazy = Lazy.of(() => 10);
			const chained = lazy.chain(chainedFactory);

			lazy.get();

			expect(chainedFactory).toBeCalledTimes(1);
			expect(chained.get()).toBe(11);
		});

		test('source factory is called when chained Lazy is accessed', () => {
			const sourceFactory = vi.fn(() => 3);
			const lazy = Lazy.of(sourceFactory);
			lazy.chain((v) => v * 3);

			// Access source, which should call factory
			lazy.get();

			expect(sourceFactory).toBeCalledTimes(1);
		});

		test('chained value is correctly transformed', () => {
			const lazy = Lazy.of(() => 'hello');
			const chained = lazy.chain((v) => v.toUpperCase());

			lazy.get();

			expect(chained.get()).toBe('HELLO');
		});
	});

	describe('Lazy.attachMulti', () => {
		test('attaches callback to multiple named lazies', () => {
			const callback = vi.fn();
			const lazies = {
				a: Lazy.of(() => 1),
				b: Lazy.of(() => 2),
				c: Lazy.of(() => 3),
			};

			Lazy.attachMulti(lazies, callback);

			lazies.a.get();
			expect(callback).toBeCalledWith('a', 1);

			lazies.b.get();
			expect(callback).toBeCalledWith('b', 2);

			lazies.c.get();
			expect(callback).toBeCalledWith('c', 3);

			expect(callback).toBeCalledTimes(3);
		});
	});

	describe('Lazy.chainMulti', () => {
		test('chains transformation across multiple named lazies', () => {
			const lazies = {
				x: Lazy.of(() => 10),
				y: Lazy.of(() => 20),
			};

			const chained = Lazy.chainMulti<number, typeof lazies, string>(
				lazies,
				(name, value) => `${name}:${value}`
			);

			// Evaluate sources first to trigger chained evaluation
			lazies.x.get();
			lazies.y.get();

			expect(chained.x.get()).toBe('x:10');
			expect(chained.y.get()).toBe('y:20');
		});

		test('preserves keys in the result', () => {
			const lazies = {
				first: Lazy.of(() => 'a'),
				second: Lazy.of(() => 'b'),
			};

			const chained = Lazy.chainMulti<string, typeof lazies, string>(lazies, (_name, value) =>
				value.toUpperCase()
			);

			expect(Object.keys(chained)).toEqual(['first', 'second']);
		});
	});

	describe('Lazy.attachAll', () => {
		test('callback is invoked when all lazies are evaluated in order', () => {
			const callback = vi.fn();
			const lazy1 = Lazy.of(() => 'one');
			const lazy2 = Lazy.of(() => 'two');
			const lazy3 = Lazy.of(() => 'three');

			Lazy.attachAll([lazy1, lazy2, lazy3], callback);

			expect(callback).not.toBeCalled();

			lazy1.get();
			expect(callback).not.toBeCalled();

			lazy2.get();
			expect(callback).not.toBeCalled();

			lazy3.get();
			expect(callback).toBeCalledTimes(1);
			expect(callback).toBeCalledWith('one', 'two', 'three');
		});

		test('callback is invoked immediately if all lazies already evaluated', () => {
			const callback = vi.fn();
			const lazy1 = Lazy.of(() => 1);
			const lazy2 = Lazy.of(() => 2);

			lazy1.get();
			lazy2.get();

			Lazy.attachAll([lazy1, lazy2], callback);

			expect(callback).toBeCalledWith(1, 2);
		});

		test('works with empty array', () => {
			const callback = vi.fn();

			Lazy.attachAll([], callback);

			expect(callback).toBeCalledTimes(1);
		});
	});

	describe('Lazy.chainAll', () => {
		test('creates a new Lazy combining all values', () => {
			const lazy1 = Lazy.of(() => 1);
			const lazy2 = Lazy.of(() => 2);
			const lazy3 = Lazy.of(() => 3);

			const combined = Lazy.chainAll([lazy1, lazy2, lazy3], (a, b, c) => a + b + c);

			// Evaluate all sources to trigger combined evaluation
			lazy1.get();
			lazy2.get();
			lazy3.get();

			expect(combined.get()).toBe(6);
		});

		test('combined Lazy is evaluated when all sources are evaluated', () => {
			const combiner = vi.fn((a: string, b: string) => a + b);
			const lazy1 = Lazy.of(() => 'hello');
			const lazy2 = Lazy.of(() => 'world');

			const combined = Lazy.chainAll([lazy1, lazy2], combiner);

			lazy1.get();
			expect(combiner).not.toBeCalled();

			lazy2.get();
			expect(combiner).toBeCalledTimes(1);
			expect(combined.get()).toBe('helloworld');
		});
	});
});

describe('LazyKeyed', () => {
	describe('LazyKeyed.of', () => {
		test('factory is not called until get() is called', () => {
			const factory = vi.fn((key: string) => key.toUpperCase());

			LazyKeyed.of(factory);

			expect(factory).not.toBeCalled();
		});

		test('factory is called with the key on first get()', () => {
			const factory = vi.fn((key: string) => key.length);
			const keyed = LazyKeyed.of(factory);

			const result = keyed.get('hello');

			expect(factory).toBeCalledWith('hello');
			expect(result).toBe(5);
		});

		test('factory is only called once per key', () => {
			const factory = vi.fn((key: string) => key);
			const keyed = LazyKeyed.of(factory);

			keyed.get('a');
			keyed.get('a');
			keyed.get('a');

			expect(factory).toBeCalledTimes(1);
		});

		test('different keys call factory separately', () => {
			const factory = vi.fn((key: string) => key);
			const keyed = LazyKeyed.of(factory);

			keyed.get('x');
			keyed.get('y');
			keyed.get('z');

			expect(factory).toBeCalledTimes(3);
		});
	});

	describe('circular dependency detection', () => {
		test('throws an error with key info when circular dependency is detected', () => {
			let keyed: LazyKeyed<number>;
			keyed = LazyKeyed.of((key) => {
				return keyed.get(key) + 1;
			});

			expect(() => keyed.get('myKey')).toThrow(
				'Circular dependency detected during LazyKeyed value creation with value: myKey'
			);
		});
	});

	describe('reserve()', () => {
		test('pre-initializes values for given keys', () => {
			const factory = vi.fn((key: string) => key);
			const keyed = LazyKeyed.of(factory);

			keyed.reserve('a', 'b', 'c');

			expect(factory).toBeCalledTimes(3);
			expect(factory).toBeCalledWith('a');
			expect(factory).toBeCalledWith('b');
			expect(factory).toBeCalledWith('c');
		});

		test('returns this for chaining', () => {
			const keyed = LazyKeyed.of((k) => k);

			const result = keyed.reserve('x');

			expect(result).toBe(keyed);
		});
	});

	describe('attach()', () => {
		test('callback is called when new values are created', () => {
			const callback = vi.fn();
			const keyed = LazyKeyed.of((key: string) => key.toUpperCase());

			keyed.attach(callback);
			keyed.get('test');

			expect(callback).toBeCalledWith('test', 'TEST');
		});

		test('callback is called for already-created values', () => {
			const keyed = LazyKeyed.of((key: string) => key.length);
			keyed.get('hello');
			keyed.get('world');

			const callback = vi.fn();
			keyed.attach(callback);

			expect(callback).toBeCalledTimes(2);
			expect(callback).toBeCalledWith('hello', 5);
			expect(callback).toBeCalledWith('world', 5);
		});

		test('returns this for chaining', () => {
			const keyed = LazyKeyed.of((k) => k);

			const result = keyed.attach(() => {});

			expect(result).toBe(keyed);
		});
	});

	describe('attachOne()', () => {
		test('callback is only called for the specified key', () => {
			const callback = vi.fn();
			const keyed = LazyKeyed.of((key: string) => key);

			keyed.attachOne('target', callback);

			keyed.get('other');
			expect(callback).not.toBeCalled();

			keyed.get('target');
			expect(callback).toBeCalledWith('target');
		});

		test('returns this for chaining', () => {
			const keyed = LazyKeyed.of((k) => k);

			const result = keyed.attachOne('key', () => {});

			expect(result).toBe(keyed);
		});
	});

	describe('chain()', () => {
		test('creates a new LazyKeyed with transformed values', () => {
			const keyed = LazyKeyed.of((key: string) => key.length);
			const chained = keyed.chain((key, value) => `${key}=${value}`);

			expect(chained.get('hello')).toBe('hello=5');
		});

		test('chained values are created when source values are created', () => {
			const chainTransform = vi.fn((key: string, value: number) => value * 2);
			const keyed = LazyKeyed.of((key: string) => key.length);
			const chained = keyed.chain(chainTransform);

			keyed.get('abc');

			expect(chainTransform).toBeCalledTimes(1);
			expect(chained.get('abc')).toBe(6);
		});
	});

	describe('chainOne()', () => {
		test('creates a Lazy for a specific key transformation', () => {
			const keyed = LazyKeyed.of((key: string) => key.toUpperCase());
			const lazy = keyed.chainOne('mykey', (value) => value + '!');

			expect(lazy.get()).toBe('MYKEY!');
		});

		test('Lazy is evaluated when source key is evaluated', () => {
			const transform = vi.fn((value: string) => value.length);
			const keyed = LazyKeyed.of((key: string) => key);
			const lazy = keyed.chainOne('test', transform);

			keyed.get('test');

			expect(transform).toBeCalledTimes(1);
			expect(lazy.get()).toBe(4);
		});
	});
});
