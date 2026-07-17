import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('astro', async (importOriginal) => {
	const astro = await importOriginal<typeof import('astro')>();
	return { ...astro, dev: vi.fn() };
});

import { dev } from 'astro';
import { loadFixture } from '../src/astroFixture.js';

const mockDev = vi.mocked(dev);
const inheritedVitestEnv = process.env.VITEST;
const temporaryRoots: string[] = [];

type DevServer = Awaited<ReturnType<typeof dev>>;

function deferred<T>() {
	let resolve: (value: T) => void;
	let reject: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve: resolve!, reject: reject! };
}

function server(port: number) {
	return { address: { address: '127.0.0.1', port } } as DevServer;
}

async function createFixture() {
	const root = await mkdtemp(join(tmpdir(), 'astro-fixture-'));
	temporaryRoots.push(root);
	return loadFixture({ root });
}

afterEach(async () => {
	mockDev.mockReset();
	if (inheritedVitestEnv === undefined) {
		delete process.env.VITEST;
	} else {
		process.env.VITEST = inheritedVitestEnv;
	}
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('startDevServer', () => {
	test('keeps VITEST suppressed until the last overlapping startup finishes', async () => {
		const firstServer = deferred<DevServer>();
		const secondServer = deferred<DevServer>();
		const observedVitestEnv: Array<string | undefined> = [];
		const expectedVitestEnv = 'fixture-race-test';
		process.env.VITEST = expectedVitestEnv;
		mockDev.mockImplementation(() => {
			observedVitestEnv.push(process.env.VITEST);
			return observedVitestEnv.length === 1 ? firstServer.promise : secondServer.promise;
		});

		const [firstFixture, secondFixture] = await Promise.all([createFixture(), createFixture()]);
		const firstStartup = firstFixture.startDevServer({});
		const secondStartup = secondFixture.startDevServer({});

		expect(observedVitestEnv).toEqual([undefined, undefined]);
		secondServer.resolve(server(4322));
		await secondStartup;
		expect(process.env.VITEST).toBeUndefined();

		firstServer.resolve(server(4321));
		await firstStartup;
		expect(process.env.VITEST).toBe(expectedVitestEnv);
	});

	test('restores VITEST after an overlapping startup fails', async () => {
		const firstServer = deferred<DevServer>();
		const secondServer = deferred<DevServer>();
		const expectedVitestEnv = 'fixture-race-error-test';
		process.env.VITEST = expectedVitestEnv;
		let calls = 0;
		mockDev.mockImplementation(() => (++calls === 1 ? firstServer.promise : secondServer.promise));

		const [firstFixture, secondFixture] = await Promise.all([createFixture(), createFixture()]);
		const firstStartup = firstFixture.startDevServer({});
		const secondStartup = secondFixture.startDevServer({});
		const firstFailure = expect(firstStartup).rejects.toThrow('Unable to start fixture');

		firstServer.reject(new Error('Unable to start fixture'));
		await firstFailure;
		expect(process.env.VITEST).toBeUndefined();

		secondServer.resolve(server(4323));
		await secondStartup;
		expect(process.env.VITEST).toBe(expectedVitestEnv);
	});
});
