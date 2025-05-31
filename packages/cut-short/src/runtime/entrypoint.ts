import type { MaybeThunk } from '@inox-tools/utils/values';
import { CarrierError } from '../internal/carrier.js';

export const endRequest = (withResponse: MaybeThunk<Response>): never => {
	throw new CarrierError(withResponse);
};

const { prerenderStopMark } = (globalThis as any)[Symbol.for('@it/cut-short')] ?? {};

export const cancelPrerender = prerenderStopMark
	? () => {
			throw new CarrierError(new Response(prerenderStopMark));
		}
	: () => {
			throw new Error('Cannot stop prerendering on server-rendered routes.');
		};
