export class Once {
	#done: boolean | Promise<void> = false;

	/**
	 * Run the callback only once.
	 *
	 * This is unsafe to be called within an async context even if the
	 * callback is sync.
	 */
	public do(callback: () => void): void {
		if (this.#done === false) {
			callback();
			this.#done = true;
		}
	}

	/**
	 * Run the callback only once.
	 *
	 * Whether the given callback or a concurrently given callback is executed,
	 * the returned promise resolves only after the callback completes successfully.
	 *
	 * If the callback fails, subsequent calls will reject immediately with the same error.
	 */
	public async doAsync(callback: () => Promise<void>): Promise<void> {
		if (this.#done === false) {
			try {
				this.#done = callback();
				await this.#done;
			} catch (error) {
				this.#done = Promise.reject(error);
				throw error;
			}
			this.#done = true;
			return;
		}

		if (this.#done !== true) await this.#done;
	}
}
