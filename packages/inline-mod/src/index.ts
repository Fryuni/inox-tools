import { magicFactory } from './closure/inspectCode.js';

export function factory<T>(factoryFn: () => T): T {
	return magicFactory({
		isAsync: false,
		fn: factoryFn,
	});
}

export function asyncFactory<T>(factoryFn: () => Promise<T>): Promise<T> {
	return magicFactory({
		isAsync: true,
		fn: factoryFn,
	});
}
