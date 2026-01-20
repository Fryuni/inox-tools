/**
 * Callback type for attaching side effects to lazy values with a name identifier.
 *
 * @template T - The type of the lazy value
 * @template O - The return type of the attachment callback (defaults to void)
 */
type LazyMapping<T, O = void> = (name: string, value: T) => O;

/**
 * Utility type that extracts the inner types from an array of Lazy instances.
 *
 * @template T - A tuple of Lazy instances
 */
export type UnwrapLazies<T extends Lazy<any>[]> = T extends [
	Lazy<infer First>,
	...infer Rest extends Lazy<any>[],
]
	? [First, ...UnwrapLazies<Rest>]
	: [];

/** Symbol indicating a lazy value is currently being created (for circular dependency detection) */
const CREATING = Symbol('creating');
/** Symbol indicating a lazy value has not yet been initialized */
const MISSING = Symbol('missing');

const SPENT_FACTORY = (): never => {
	throw new Error('This Lazy value has already been consumed.');
};

/**
 * A lazily computed memoized value.
 *
 * The given factory is only constructed on first use of the value.
 * Any subsequent use retrieves the same instance of the value.
 *
 * If the value is accessed while it is being created, an error is thrown to prevent circular dependencies.
 * When that happens, the Lazy instance becomes unusable.
 *
 * Lazy implements the Promise interface, allowing it to be awaited directly.
 *
 * @template T - The type of the lazily computed value
 */
export class Lazy<T> implements Promise<T> {
	private value: T | typeof CREATING | typeof MISSING = MISSING;

	private attachments?: ((value: T) => void)[] = [];

	private constructor(private factory: () => T) { }

	/**
	 * Creates a new Lazy instance from a factory function.
	 *
	 * @param factory - A function that produces the value when first accessed
	 * @returns A new Lazy instance wrapping the factory
	 */
	public static of<T>(factory: () => T): Lazy<T> {
		return new Lazy(factory);
	}

	/**
	 * Wrap the given factory into a lazily computed memoized value.
	 *
	 * The function will at most be called once, on the first use of the value.
	 */
	public static wrap<T>(factory: () => T): () => T {
		const lazy = Lazy.of(factory);
		return lazy.get.bind(lazy);
	}

	/**
	 * Gets the lazily computed value, creating it if necessary.
	 *
	 * @returns The computed value
	 * @throws Error if a circular dependency is detected during value creation
	 */
	public get(): T {
		if (this.value === MISSING) {
			this.value = CREATING;
			const value = this.factory();
			// Mark factory as spent to prevent reuse and release references to closure.
			this.factory = SPENT_FACTORY;
			this.value = value;
			for (const attach of this.attachments!) {
				attach(value);
			}
			delete this.attachments;
		}
		if (this.value === CREATING) {
			throw new Error('Circular dependency detected during Lazy value creation.');
		}

		return this.value;
	}

	public ensureInitialized(): void {
		if (this.value === CREATING) {
			// this Lazy is already being created; do nothing to avoid circular dependency
			return;
		}
		this.get();
	}

	/**
	 * Implements Promise.then() for Promise compatibility.
	 * Allows the Lazy instance to be awaited.
	 */
	public then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
	): Promise<TResult1 | TResult2> {
		return Promise.resolve()
			.then(() => this.get())
			.then(onfulfilled, onrejected);
	}

	/**
	 * Implements Promise.catch() for Promise compatibility.
	 */
	public catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined
	): Promise<T | TResult> {
		return this.then(undefined, onrejected);
	}

	/**
	 * Implements Promise.finally() for Promise compatibility.
	 */
	public finally(onfinally?: (() => void) | null | undefined): Promise<T> {
		return this.then().finally(onfinally);
	}

	/** String tag for Object.prototype.toString */
	[Symbol.toStringTag]: string = 'Lazy';

	/**
	 * Registers a callback to be executed when, and if, the lazy value is computed.
	 * If the value is already computed, the callback is invoked immediately.
	 *
	 * @param attach - Callback to execute with the computed value
	 * @returns This instance for chaining
	 */
	public attach(attach: (value: T) => void): this {
		if (this.value !== MISSING && this.value !== CREATING) {
			attach(this.value as T); // Force evaluation if already present
		} else {
			this.attachments!.push(attach);
		}
		return this;
	}

	/**
	 * Creates a new Lazy that transforms this value using the provided function.
	 * The new Lazy is automatically evaluated when this one is evaluated.
	 * This way, if either Lazy is evaluated, both values are computed.
	 *
	 * @template O - The type of the transformed value
	 * @param mapper - Transformation function to apply to the value
	 * @returns A new Lazy instance containing the transformed value
	 */
	public chain<O>(mapper: (value: T) => O): Lazy<O> {
		const other = Lazy.of(() => mapper(this.get()));

		this.attach(() => other.ensureInitialized());

		return other;
	}

	/**
	 * Attaches a callback to multiple named lazy values.
	 * The callback receives both the name and value for each lazy when evaluated.
	 *
	 * @template T - The type of the lazy values
	 * @param lazies - Record of named Lazy instances
	 * @param attach - Callback to execute for each lazy value
	 */
	public static attachMulti<T>(lazies: Record<string, Lazy<T>>, attach: LazyMapping<T>): void {
		for (const [name, lazy] of Object.entries(lazies)) {
			lazy.attach((value) => attach(name, value));
		}
	}

	/**
	 * Chains a transformation across multiple named lazy values.
	 * Creates a new record of Lazy instances with transformed values.
	 *
	 * @template T - The type of the input lazy values
	 * @template R - The record type containing the lazy instances
	 * @template O - The type of the transformed values
	 * @param lazies - Record of named Lazy instances
	 * @param mapper - Transformation function receiving name and value
	 * @returns A new record of Lazy instances with the same keys
	 */
	public static chainMulti<T, const R extends Record<string, Lazy<T>>, O>(
		lazies: R,
		mapper: LazyMapping<T, O>
	): Record<keyof R, Lazy<O>> {
		const result: Record<string, Lazy<O>> = {};
		for (const [name, lazy] of Object.entries(lazies)) {
			result[name] = lazy.chain((value) => mapper(name, value));
		}

		return result as Record<keyof R, Lazy<O>>;
	}

	/**
	 * Attaches a callback that is invoked when all lazy values in the array are evaluated.
	 * The callback receives all values as arguments in order.
	 *
	 * @template Ts - Tuple type of Lazy instances
	 * @param lazies - Array of Lazy instances to wait for
	 * @param attach - Callback receiving all unwrapped values
	 */
	public static attachAll<const Ts extends Lazy<any>[]>(
		lazies: Ts,
		attach: (...args: UnwrapLazies<Ts>) => void
	): void {
		function attachNext(index = 0) {
			if (index >= lazies.length) {
				attach(...(lazies.map((l) => l.get()) as UnwrapLazies<Ts>));
				return;
			}

			lazies[index].attach(() => {
				attachNext(index + 1);
			});
		}

		attachNext();
	}

	/**
	 * Creates a new Lazy that combines all values from the given lazy instances.
	 * The transformation is invoked when all input lazies are evaluated.
	 *
	 * @template Ts - Tuple type of Lazy instances
	 * @template O - The type of the combined result
	 * @param lazies - Array of Lazy instances to combine
	 * @param mapper - Transformation function receiving all unwrapped values
	 * @returns A new Lazy instance containing the combined result
	 */
	public static chainAll<const Ts extends Lazy<any>[], O>(
		lazies: Ts,
		mapper: (...args: UnwrapLazies<Ts>) => O
	): Lazy<O> {
		const lazy = Lazy.of(() => mapper(...(lazies.map((l) => l.get()) as UnwrapLazies<Ts>)));

		this.attachAll(lazies, () => lazy.ensureInitialized());

		return lazy;
	}
}

/**
 * A keyed lazy value store that memoizes values by string key.
 *
 * Each key maps to a lazily computed value that is only created on first access.
 * Supports attachments that are notified when new values are created.
 * @template T - The type of values stored
 */
export class LazyKeyed<T> {
	/** Map of key to either a tuple containing the value or CREATING symbol */
	private readonly instances = new Map<string, [T] | typeof CREATING>();

	/** List of callbacks to invoke when any value is created */
	private readonly attachments: LazyMapping<T>[] = [];

	private constructor(private factory: (key: string) => T) { }

	/**
	 * Creates a new LazyKeyed instance from a factory function.
	 * @param factory - A function that produces a value for a given key
	 * @returns A new LazyKeyed instance
	 */
	public static of<T>(factory: (key: string) => T): LazyKeyed<T> {
		return new this(factory);
	}

	/**
	 * Gets the value for the given key, creating it if necessary.
	 * @param key - The key to look up or create
	 * @returns The value associated with the key
	 * @throws Error if a circular dependency is detected during value creation
	 */
	public get(key: string): T {
		const stored = this.instances.get(key);

		if (stored === CREATING) {
			throw new Error(
				'Circular dependency detected during LazyKeyed value creation with value: ' + key
			);
		}

		if (stored !== undefined) {
			return stored[0];
		}

		this.instances.set(key, CREATING);

		const newInstance = this.factory(key);

		this.instances.set(key, [newInstance]);

		for (const attach of this.attachments) {
			attach(key, newInstance);
		}

		return newInstance;
	}

	/**
	 * Pre-initializes values for the given keys.
	 * Useful for eagerly creating values that will be needed later.
	 * @param key - The first key to reserve
	 * @param keys - Additional keys to reserve
	 * @returns This instance for chaining
	 */
	public reserve(key: string, ...keys: string[]): this {
		keys.unshift(key);
		for (const k of keys) {
			if (this.instances.get(k) === undefined) {
				this.get(k);
			}
		}
		return this;
	}

	/**
	 * Registers a callback to be executed for each value when created.
	 * Immediately invokes the callback for any already-created values.
	 * @param attach - Callback receiving the key and value
	 * @returns This instance for chaining
	 */
	public attach(attach: LazyMapping<T>): this {
		for (const [name, instance] of this.instances.entries()) {
			if (instance !== CREATING) {
				attach(name, instance[0]);
			}
		}
		this.attachments.push(attach);
		return this;
	}

	/**
	 * Registers a callback for a specific key only.
	 * The callback is invoked when the value for that key is created.
	 * @param key - The key to watch
	 * @param attach - Callback receiving the value
	 * @returns This instance for chaining
	 */
	public attachOne(key: string, attach: (value: T) => void): this {
		return this.attach((name, value) => {
			if (name === key) {
				attach(value);
			}
		});
	}

	/**
	 * Creates a new LazyKeyed that transforms values using the provided function.
	 * Values in the new LazyKeyed are automatically created when source values are created.
	 * @template O - The type of the transformed values
	 * @param mapper - Transformation function receiving key and value
	 * @returns A new LazyKeyed instance with transformed values
	 */
	public chain<O>(mapper: LazyMapping<T, O>): LazyKeyed<O> {
		const newKeyed = LazyKeyed.of((key) => mapper(key, this.get(key)));

		this.attach((key) => {
			newKeyed.reserve(key);
		});

		return newKeyed;
	}

	/**
	 * Creates a Lazy that transforms the value for a specific key.
	 * The Lazy is automatically evaluated when the source value is created.
	 * @template O - The type of the transformed value
	 * @param key - The key to transform
	 * @param mapper - Transformation function receiving the value
	 * @returns A Lazy instance containing the transformed value
	 */
	public chainOne<O>(key: string, mapper: (value: T) => O): Lazy<O> {
		const lazy = Lazy.of(() => mapper(this.get(key)));
		this.attachOne(key, () => lazy.ensureInitialized());
		return lazy;
	}
}
