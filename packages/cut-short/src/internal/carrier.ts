import { loadThunkValue, type MaybeThunk } from '@inox-tools/utils/values';

export class CarrierError extends Error {
	public constructor(private readonly response: MaybeThunk<Response>) {
		super('CarrierError');
	}

	public getResponse(): Promise<Response> {
		return Promise.resolve(loadThunkValue(this.response));
	}
}
