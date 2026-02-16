import { describe, expect, test } from 'vitest';
import { atom, computed } from 'nanostores';
import { resolvedAtom } from '../src/nano.js';

describe('resolvedAtom', () => {
	describe('primitive values', () => {
		test('resolves a string', () => {
			const result = resolvedAtom('hello');
			expect(result.get()).toBe('hello');
		});

		test('resolves a number', () => {
			const result = resolvedAtom(42);
			expect(result.get()).toBe(42);
		});

		test('resolves a boolean', () => {
			const result = resolvedAtom(true);
			expect(result.get()).toBe(true);
		});

		test('resolves null', () => {
			const result = resolvedAtom(null);
			expect(result.get()).toBe(null);
		});

		test('resolves undefined', () => {
			const result = resolvedAtom(undefined);
			expect(result.get()).toBe(undefined);
		});
	});

	describe('atom values', () => {
		test('resolves a single atom to its current value', () => {
			const $name = atom('Alice');
			const result = resolvedAtom($name);
			expect(result.get()).toBe('Alice');
		});

		test('resolves a computed atom to its current value', () => {
			const $count = atom(5);
			const $doubled = computed($count, (n) => n * 2);
			const result = resolvedAtom($doubled);
			expect(result.get()).toBe(10);
		});
	});

	describe('objects', () => {
		test('resolves an empty object', () => {
			const result = resolvedAtom({});
			expect(result.get()).toEqual({});
		});

		test('resolves an object with only primitive values', () => {
			const result = resolvedAtom({ a: 1, b: 'two' });
			expect(result.get()).toEqual({ a: 1, b: 'two' });
		});

		test('resolves an object with atom values', () => {
			const $name = atom('Alice');
			const $age = atom(30);
			const result = resolvedAtom({ name: $name, age: $age });
			expect(result.get()).toEqual({ name: 'Alice', age: 30 });
		});

		test('resolves an object with mixed atom and primitive values', () => {
			const $name = atom('Alice');
			const result = resolvedAtom({ name: $name, role: 'admin' });
			expect(result.get()).toEqual({ name: 'Alice', role: 'admin' });
		});
	});

	describe('arrays', () => {
		test('resolves an empty array', () => {
			const result = resolvedAtom([]);
			expect(result.get()).toEqual([]);
		});

		test('resolves an array with only primitive values', () => {
			const result = resolvedAtom([1, 'two', true]);
			expect(result.get()).toEqual([1, 'two', true]);
		});

		test('resolves an array with atom values', () => {
			const $a = atom(1);
			const $b = atom(2);
			const result = resolvedAtom([$a, $b]);
			expect(result.get()).toEqual([1, 2]);
		});

		test('resolves an array with mixed atom and primitive values', () => {
			const $a = atom(1);
			const result = resolvedAtom([$a, 'hello', 42]);
			expect(result.get()).toEqual([1, 'hello', 42]);
		});
	});

	describe('nested structures', () => {
		test('resolves atoms in nested objects', () => {
			const $city = atom('NYC');
			const result = resolvedAtom({
				user: {
					address: {
						city: $city,
					},
				},
			});
			expect(result.get()).toEqual({ user: { address: { city: 'NYC' } } });
		});

		test('resolves atoms in arrays inside objects', () => {
			const $tag1 = atom('ts');
			const $tag2 = atom('js');
			const result = resolvedAtom({
				tags: [$tag1, $tag2],
			});
			expect(result.get()).toEqual({ tags: ['ts', 'js'] });
		});

		test('resolves atoms in objects inside arrays', () => {
			const $name = atom('Alice');
			const result = resolvedAtom([{ name: $name }]);
			expect(result.get()).toEqual([{ name: 'Alice' }]);
		});
	});

	describe('reactivity', () => {
		test('updates when a dependency atom changes', () => {
			const $name = atom('Alice');
			const result = resolvedAtom({ name: $name });

			const values: unknown[] = [];
			result.subscribe((v) => values.push(structuredClone(v)));

			$name.set('Bob');

			expect(values).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
		});

		test('updates when any dependency in a flat structure changes', () => {
			const $first = atom('John');
			const $last = atom('Doe');
			const result = resolvedAtom({ first: $first, last: $last });

			const values: unknown[] = [];
			result.subscribe((v) => values.push(structuredClone(v)));

			$first.set('Jane');
			$last.set('Smith');

			expect(values).toEqual([
				{ first: 'John', last: 'Doe' },
				{ first: 'Jane', last: 'Doe' },
				{ first: 'Jane', last: 'Smith' },
			]);
		});

		test('updates when a deeply nested dependency changes', () => {
			const $value = atom(1);
			const result = resolvedAtom({ a: { b: { c: $value } } });

			const values: unknown[] = [];
			result.subscribe((v) => values.push(structuredClone(v)));

			$value.set(2);

			expect(values).toEqual([{ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }]);
		});

		test('updates when an atom in an array changes', () => {
			const $item = atom('a');
			const result = resolvedAtom([$item, 'b']);

			const values: unknown[] = [];
			result.subscribe((v) => values.push(structuredClone(v)));

			$item.set('x');

			expect(values).toEqual([
				['a', 'b'],
				['x', 'b'],
			]);
		});

		test('stops updating after unsubscribing', () => {
			const $name = atom('Alice');
			const result = resolvedAtom({ name: $name });

			const values: unknown[] = [];
			const unsubscribe = result.subscribe((v) => values.push(structuredClone(v)));

			$name.set('Bob');
			unsubscribe();
			$name.set('Charlie');

			expect(values).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
		});
	});

	describe('shared references', () => {
		test('handles the same atom referenced multiple times', () => {
			const $shared = atom('shared');
			const result = resolvedAtom({ a: $shared, b: $shared });
			expect(result.get()).toEqual({ a: 'shared', b: 'shared' });
		});

		test('emits a single update when a shared atom changes', () => {
			const $shared = atom(1);
			const result = resolvedAtom({ x: $shared, y: $shared });

			const values: unknown[] = [];
			result.subscribe((v) => values.push(structuredClone(v)));

			$shared.set(2);

			expect(values).toEqual([
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
			]);
		});
	});

	describe('return type', () => {
		test('returns a ReadableAtom', () => {
			const result = resolvedAtom('test');
			expect(typeof result.get).toBe('function');
			expect(typeof result.listen).toBe('function');
			expect(typeof result.subscribe).toBe('function');
		});
	});
});
