import { describe, expect, test, vi } from 'vitest';
import { runEveryAstro, type BisectSession, type EveryAstroDependencies } from '../src/workflow.js';

class FakeSession implements BisectSession {
	readonly events: string[] = [];
	readonly prepareRevision = vi.fn(async (_revision: string) => {});
	readonly runDevServerAndAsk = vi.fn(async (_label: string) => false);
	readonly startBisect = vi.fn(async (_good: string, _bad: string) => {});
	readonly currentRevision = vi.fn(async () => 'candidate');
	readonly markCurrent = vi.fn<(isBad: boolean) => Promise<string | undefined>>(
		async (_isBad) => undefined
	);
	readonly close = vi.fn(async () => {
		this.events.push('close');
	});
	readonly latestRevision = vi.fn(async () => 'latest-sha');
}

function dependencies(session: FakeSession, astroMajor = 6) {
	const logs: string[] = [];
	const deps: EveryAstroDependencies = {
		installedAstroMajor: vi.fn(async () => astroMajor),
		createSession: vi.fn(async () => session),
		log: (message) => {
			session.events.push(`log:${message}`);
			logs.push(message);
		},
	};

	return { deps, logs };
}

describe('runEveryAstro', () => {
	test('stops after the latest revision is good and reports that the bug is fixed', async () => {
		const session = new FakeSession();
		session.runDevServerAndAsk.mockResolvedValue(false);
		const { deps, logs } = dependencies(session);

		await runEveryAstro(deps);

		expect(session.prepareRevision).toHaveBeenCalledExactlyOnceWith('latest-sha');
		expect(session.runDevServerAndAsk).toHaveBeenCalledExactlyOnceWith('latest');
		expect(session.startBisect).not.toHaveBeenCalled();
		expect(session.markCurrent).not.toHaveBeenCalled();
		expect(logs).toEqual(['The bug is already fixed in the latest Astro revision.']);
		expect(session.close).toHaveBeenCalledExactlyOnceWith();
		expect(session.events).toEqual([
			'close',
			'log:The bug is already fixed in the latest Astro revision.',
		]);
	});

	test('stops when the first release of the installed major is bad and reports that it predates the major', async () => {
		const session = new FakeSession();
		session.runDevServerAndAsk.mockResolvedValue(true);
		const { deps, logs } = dependencies(session, 7);

		await runEveryAstro(deps);

		expect(session.prepareRevision).toHaveBeenNthCalledWith(1, 'latest-sha');
		expect(session.prepareRevision).toHaveBeenNthCalledWith(2, 'astro@7.0.0');
		expect(session.runDevServerAndAsk).toHaveBeenNthCalledWith(1, 'latest');
		expect(session.runDevServerAndAsk).toHaveBeenNthCalledWith(2, 'v7.0.0');
		expect(session.startBisect).not.toHaveBeenCalled();
		expect(session.markCurrent).not.toHaveBeenCalled();
		expect(logs).toEqual(['The bug predates Astro v7.']);
		expect(session.close).toHaveBeenCalledExactlyOnceWith();
		expect(session.events).toEqual(['close', 'log:The bug predates Astro v7.']);
	});

	test('bisects between the first good release and latest bad revision, then reports the exact first bad commit', async () => {
		const session = new FakeSession();
		session.currentRevision
			.mockResolvedValueOnce('candidate-a')
			.mockResolvedValueOnce('candidate-b');
		session.runDevServerAndAsk
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false);
		session.markCurrent.mockResolvedValueOnce(undefined).mockResolvedValueOnce('first-bad-sha');
		const { deps, logs } = dependencies(session, 5);

		await runEveryAstro(deps);

		expect(session.startBisect).toHaveBeenCalledExactlyOnceWith('astro@5.0.0', 'latest-sha');
		expect(session.prepareRevision).toHaveBeenNthCalledWith(1, 'latest-sha');
		expect(session.prepareRevision).toHaveBeenNthCalledWith(2, 'astro@5.0.0');
		expect(session.prepareRevision).toHaveBeenNthCalledWith(3, 'candidate-a');
		expect(session.prepareRevision).toHaveBeenNthCalledWith(4, 'candidate-b');
		expect(session.runDevServerAndAsk).toHaveBeenNthCalledWith(1, 'latest');
		expect(session.runDevServerAndAsk).toHaveBeenNthCalledWith(2, 'v5.0.0');
		expect(session.runDevServerAndAsk).toHaveBeenNthCalledWith(3, 'candidate-a');
		expect(session.runDevServerAndAsk).toHaveBeenNthCalledWith(4, 'candidate-b');
		expect(session.markCurrent).toHaveBeenNthCalledWith(1, true);
		expect(session.markCurrent).toHaveBeenNthCalledWith(2, false);
		expect(logs).toEqual(['The bug was introduced in Astro commit first-bad-sha.']);
		expect(session.close).toHaveBeenCalledExactlyOnceWith();
		expect(session.events).toEqual([
			'close',
			'log:The bug was introduced in Astro commit first-bad-sha.',
		]);
	});

	type FailureCase = {
		name: string;
		configure(session: FakeSession): void;
	};

	test.each<FailureCase>([
		{
			name: 'preparing a revision',
			configure: (session: FakeSession) => {
				session.prepareRevision.mockRejectedValueOnce(new Error('prepare failed'));
			},
		},
		{
			name: 'asking about the dev server',
			configure: (session: FakeSession) => {
				session.runDevServerAndAsk.mockRejectedValueOnce(new Error('prompt failed'));
			},
		},
		{
			name: 'marking a bisect revision',
			configure: (session: FakeSession) => {
				session.runDevServerAndAsk
					.mockResolvedValueOnce(true)
					.mockResolvedValueOnce(false)
					.mockResolvedValueOnce(true);
				session.markCurrent.mockRejectedValueOnce(new Error('mark failed'));
			},
		},
	])('closes the session when $name throws', async ({ configure }) => {
		const session = new FakeSession();
		configure(session);
		const { deps, logs } = dependencies(session);

		await expect(runEveryAstro(deps)).rejects.toThrow(/failed/);

		expect(session.close).toHaveBeenCalledExactlyOnceWith();
		expect(logs).toEqual([]);
		expect(session.events).toEqual(['close']);
	});

	test('rejects without a result log when session cleanup fails', async () => {
		const session = new FakeSession();
		session.runDevServerAndAsk.mockResolvedValue(false);
		session.close.mockImplementation(async () => {
			session.events.push('close');
			throw new Error('cleanup failed');
		});
		const { deps, logs } = dependencies(session);

		await expect(runEveryAstro(deps)).rejects.toThrow('cleanup failed');

		expect(logs).toEqual([]);
		expect(session.close).toHaveBeenCalledExactlyOnceWith();
		expect(session.events).toEqual(['close']);
	});
});
