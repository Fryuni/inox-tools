import type { MaybeThunk } from '@inox-tools/utils/types';

export class CarrierError extends Error {
  public constructor(private readonly response: MaybeThunk<Response>) {
    super('CarrierError');
  }

  public getResponse(): Promise<Response> {
    return Promise.resolve(typeof this.response === 'function' ? this.response() : this.response);
  }
}
