import type { SerializedModule } from './closure/serialization.js';

/** @internal */
export const modRegistry = new Map<string, Promise<SerializedModule>>();
