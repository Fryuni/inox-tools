export class Once {
	readonly #done = false;

	public do(callback: () => void): void {
		if (!this.#done) {
			callback();
		}
	}
}
