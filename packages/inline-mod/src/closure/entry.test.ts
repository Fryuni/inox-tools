import { describe, it, expect } from 'vitest';
import { Entry, EntryRegistry } from './entry.js';

describe('A smart entry registry', () => {
	const entry: Entry = {
		type: 'expr',
		value: 'fooExpr',
	};

	it('should return the entry added for a key', () => {
		const registry = new EntryRegistry();

		registry.add('foo', entry);

		expect(registry.lookup('foo')).toBe(entry);
		expect(registry.lookup('bar')).toBeUndefined();
	});

	it('should support sealing', () => {
		const registry: EntryRegistry<string> = new EntryRegistry<string>();

		registry.seal();

		expect(() => registry.add('foo', entry)).toThrow();
	});

	it('should fork into independent copies', () => {
		const baseRegistry = new EntryRegistry<string>();

		const entryOne: Entry = { type: 'expr', value: 'one' };
		const entryTwo: Entry = { type: 'expr', value: 'two' };

		baseRegistry.add('foo', entryOne);

		const forkOne = baseRegistry.fork();
		const forkTwo = forkOne.fork();

		expect(forkOne.lookup('foo')).toBe(entryOne);
		expect(forkTwo.lookup('foo')).toBe(entryOne);

		forkOne.remove('foo');
		forkOne.add('foo', entryTwo);

		expect(forkTwo.remove('foo')).toBe(entryOne);

		expect(baseRegistry.lookup('foo')).toBe(entryOne);
		expect(forkOne.lookup('foo')).toBe(entryTwo);
		expect(forkTwo.lookup('foo')).toBeUndefined();

		baseRegistry.add('bar', entryTwo);

		expect(forkOne.lookup('bar')).toBeUndefined();
		expect(forkTwo.lookup('bar')).toBeUndefined();
	});
});
