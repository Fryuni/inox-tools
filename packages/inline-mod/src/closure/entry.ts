import type { InspectedFunction, InspectedObject } from './types.js';

type EntryMap = {
	// A value which can be safely json serialized.
	json: any;

	// An RegExp. Will be serialized as 'new RegExp(re.source, re.flags)'
	regexp: { source: string; flags: string };

	// A closure we are dependent on.
	function: InspectedFunction;

	// An object which may contain nested closures.
	// Can include an optional proto if the user is not using the default Object.prototype.
	object: InspectedObject;

	// An array which may contain nested closures.
	array: Entry[];

	// A reference to a requirable module name.
	module: {
		type: 'default' | 'star';
		reference: string;
	};

	// A promise value.  this will be serialized as the underlyign value the promise
	// points to.  And deserialized as Promise.resolve(<underlying_value>)
	promise: Entry;

	// A simple expression to use to represent this instance.  For example "global.Number";
	expr: string;

	// A placeholder for a pending entry
	pending: never;
};

export type Entry<T extends keyof EntryMap = keyof EntryMap> = {
	[K in keyof EntryMap]: {
		type: K;
		value: EntryMap[K];
	};
}[T];

export namespace Entry {
	export function expr(expr: string): Entry<'expr'> {
		return { type: 'expr', value: expr };
	}

	export function json(json?: any): Entry<'json'> {
		return { type: 'json', value: json };
	}

	export function regexp(regexp: RegExp): Entry<'regexp'> {
		return { type: 'regexp', value: regexp };
	}

	export function array(array: Entry[]): Entry<'array'> {
		return { type: 'array', value: array };
	}
}

export type SealedRegistry<K> = Omit<EntryRegistry<K>, 'add'>;

export class EntryRegistry<K> {
	protected readonly inner = new Map<K, Entry>();

	#sealed = false;

	public lookup(key: K): Entry | undefined {
		return this.inner.get(key);
	}

	public preparedLookup(key: K): Entry {
		if (key === undefined || key === null) {
			// Undefined and null keys can never be set.
			return { type: 'pending' } as Entry<'pending'>;
		}

		const existingEntry = this.lookup(key);
		if (existingEntry === undefined) {
			this.prepare(key);

			// The key is set on prepare.
			return this.lookup(key)!;
		}

		return existingEntry;
	}

	public add(key: K, entry: Entry) {
		if (key === undefined || key === null) {
			return;
		}

		const existingEntry = this.lookup(key);

		if (Object.is(existingEntry, entry)) {
			// Entry already stored. Do nothing.
			return;
		}

		if (existingEntry !== undefined) {
			if (existingEntry.type === 'pending') {
				Object.assign(existingEntry, entry);
				return;
			}

			throw new Error('An entry for the given key was already registered.');
		}

		if (this.#sealed) {
			throw new Error('Cannot add to a sealed registry');
		}

		this.inner.set(key, entry);
	}

	public prepare(key: K) {
		// Pending entry is intentionally not constructable without a cast
		this.add(key, { type: 'pending' } as Entry<'pending'>);
	}

	public remove(key: K): Entry | undefined {
		const removedEntry = this.inner.get(key);
		return this.inner.delete(key) ? removedEntry : undefined;
	}

	public fork(): EntryRegistry<K> {
		if (this.#sealed) {
			// We are immutable, so there is no risk of interference
			return new LayeredRegistry(this);
		}

		// We are mutatble, so we move our current self down and
		// become a layered registry as well.
		// This pins the data up to this point and allow two independent
		// registries to share the base map without re-allocating.

		const newBase: EntryRegistry<K> = Object.assign(
			Object.create(Object.getPrototypeOf(this)),
			this
		);

		const forked = new LayeredRegistry(newBase);

		// Become a fork ourselves
		const newThis = new LayeredRegistry(newBase);
		Object.setPrototypeOf(this, Object.getPrototypeOf(newThis));
		Object.assign(this, newThis);

		return forked;
	}

	public get sealed(): boolean {
		return this.#sealed;
	}

	public seal(): asserts this is SealedRegistry<K> {
		this.#sealed = true;
	}
}

/**
 * Forked sides of a registry
 *
 * @internal
 */
class LayeredRegistry<K> extends EntryRegistry<K> {
	private readonly deletedKeys = new Set<K>();

	public constructor(private readonly parent: EntryRegistry<K>) {
		super();
	}

	public lookup(key: K): Entry | undefined {
		return this.inner.get(key) ?? this.parentLookup(key);
	}

	private parentLookup(key: K): Entry | undefined {
		if (this.deletedKeys.has(key)) {
			return;
		}

		return this.parent.lookup(key);
	}

	public remove(key: K): Entry | undefined {
		const removedEntry = this.lookup(key);

		this.inner.delete(key);
		this.deletedKeys.add(key);

		return removedEntry;
	}

	public fork(): EntryRegistry<K> {
		if (this.deletedKeys.size === 0 && this.inner.size === 0) {
			// Optimization. If we have not layered any change on top of our
			// parent, our fork can be our sibling.
			return new LayeredRegistry(this.parent);
		}

		return super.fork();
	}
}
