import type { MiddlewareHandler } from 'astro';
import { debug } from '../internal/debug.js';
import { CarrierError } from '../internal/carrier.js';

export const onRequest: MiddlewareHandler = async (_, next) => {
  try {
    return await next();
  } catch (err: unknown) {
    if (err instanceof CarrierError) {
      debug('Returning response from CarrierError');
      return err.getResponse();
    }

    throw err;
  }
};
