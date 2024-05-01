import { describe, expect, test, vi } from 'vitest';
import { Lazy } from '../src/lazy.js';

describe('A Lazy instance constructor', () => {
	test('the factory is not called if the value is not read', () => {
		const factory = vi.fn();

		Lazy.of(factory);

		expect(factory).not.toBeCalled();
	});
});
