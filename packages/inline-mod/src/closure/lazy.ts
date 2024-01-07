export class Lazy<T> {
  private initialized = false;
  private value?: T;
  private constructor(private factory: () => T) {}

  public static of<T>(factory: () => T): Lazy<T> {
    return new this(factory);
  }

  public get(): T {
    if (!this.initialized) {
      this.value = this.factory();
      this.initialized = true;
    }

    return this.value!;
  }
}
