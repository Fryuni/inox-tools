import type { MaybeThunk } from '@inox-tools/utils/types';
import { CarrierError } from '../internal/carrier.js';

export const endRequest = (withResponse: MaybeThunk<Response>): never => {
  throw new CarrierError(withResponse);
};
