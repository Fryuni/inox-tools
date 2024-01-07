import { createHash } from 'node:crypto';
import { serializeFunction } from './closure/serializeClosure.js';
import { modRegistry } from './state.js';

export default function inlineMod(mod: Record<string, unknown>): string {
	if (typeof mod.default === 'function') {
		const modContent = serializeFunction(mod.default, {}).text;

		const hash = createHash('md5').update(modContent);
		const id = hash.digest('hex');
		hash.destroy();

		modRegistry.set(id, modContent);

		return id;
	}

	return '';
}
