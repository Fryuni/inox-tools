import type { MaybeThunk } from '@inox-tools/utils/values';
import { CarrierError } from '../internal/carrier.js';

export const endRequest = (withResponse: MaybeThunk<Response>): never => {
	throw new CarrierError(withResponse);
};
