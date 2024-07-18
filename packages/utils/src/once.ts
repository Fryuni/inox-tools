export class Once {
	#done = false;

	public do(callback: () => void): void {
		if (!this.#done) {
			callback();
			this.#done = true;
		}
	}

	public async doAsync(callback: () => Promise<void>): Promise<void> {
		if (!this.#done) {
			await callback();
			this.#done = true;
		}
	}
}
