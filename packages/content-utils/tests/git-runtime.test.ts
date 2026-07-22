import { afterEach, describe, expect, it, vi } from 'vitest';

const childProcess = vi.hoisted(() => ({
	spawnSync: vi.fn(),
}));

const modularStation = vi.hoisted(() => ({
	hooks: {
		run: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('node:child_process', () => childProcess);
vi.mock('@inox-tools/modular-station/hooks', () => modularStation);

import {
	collectGitInfoForContentFiles,
	getFileContentAtCommit,
	setCollectCommitHistory,
	setProjectRoot,
} from '../src/runtime/git.js';

function repoRootCalls() {
	return childProcess.spawnSync.mock.calls.filter(([, args]) => args[0] === 'rev-parse');
}

function gitCommit(hash: string, seconds: number, entries: string[]) {
	return `\0t:${hash} ${seconds} Test Author <test@example.com>|\0\n${entries.join('\0')}\0`;
}

function mockHistory(log: string, currentPaths: string) {
	childProcess.spawnSync.mockImplementation((_, args) => {
		switch (args[0]) {
			case 'rev-parse':
				return { status: 0, stdout: '/repo\n' };
			case 'log':
				return { status: 0, stdout: log };
			case 'ls-files':
				return { status: 0, stdout: currentPaths };
			default:
				throw new Error(`Unexpected git command: ${args.join(' ')}`);
		}
	});
}

afterEach(() => {
	childProcess.spawnSync.mockReset();
	setProjectRoot(process.cwd());
	setCollectCommitHistory(true);
});

describe('git repository root lookup', () => {
	it('memoizes a resolved root until the project root changes', () => {
		childProcess.spawnSync.mockImplementation((_, args, options) => {
			if (args[0] === 'rev-parse') {
				return {
					stdout: options.cwd === '/project/one' ? '/repo/one\n' : '/repo/two\n',
				};
			}

			return { status: 0, stdout: options.cwd };
		});

		setProjectRoot('/project/one');
		expect(getFileContentAtCommit('first', 'entry.md')).toBe('/repo/one');
		expect(getFileContentAtCommit('second', 'entry.md')).toBe('/repo/one');
		expect(repoRootCalls()).toHaveLength(1);

		setProjectRoot('/project/two');
		expect(getFileContentAtCommit('third', 'entry.md')).toBe('/repo/two');
		expect(repoRootCalls()).toHaveLength(2);
		expect(repoRootCalls().map(([, , options]) => options.cwd)).toEqual([
			'/project/one',
			'/project/two',
		]);
	});

	it('memoizes the project-root fallback until the project root changes', () => {
		childProcess.spawnSync.mockImplementation((_, args, options) => {
			if (args[0] === 'rev-parse') {
				return { error: new Error('not a repository'), stderr: 'not a repository' };
			}

			return { status: 0, stdout: options.cwd };
		});

		setProjectRoot('/outside/one');
		expect(getFileContentAtCommit('first', 'entry.md')).toBe('/outside/one');
		expect(getFileContentAtCommit('second', 'entry.md')).toBe('/outside/one');
		expect(repoRootCalls()).toHaveLength(1);

		setProjectRoot('/outside/two');
		expect(getFileContentAtCommit('third', 'entry.md')).toBe('/outside/two');
		expect(repoRootCalls()).toHaveLength(2);
		expect(repoRootCalls().map(([, , options]) => options.cwd)).toEqual([
			'/outside/one',
			'/outside/two',
		]);
	});
});

describe('git content retrieval', () => {
	it('returns committed content larger than Node’s default spawn buffer', () => {
		const content = 'x'.repeat(1024 * 1024 + 1);
		childProcess.spawnSync.mockImplementation((_, args) => {
			if (args[0] === 'rev-parse') return { status: 0, stdout: '/repo\n' };
			return { status: 0, stdout: content };
		});

		expect(getFileContentAtCommit('hash', 'content/large.md')).toBe(content);
		const [, , options] = childProcess.spawnSync.mock.calls.find(([, args]) => args[0] === 'show')!;
		expect(options.maxBuffer).toBeGreaterThan(content.length);
	});

	it('returns an empty string when git cannot read committed content', () => {
		childProcess.spawnSync.mockImplementation((_, args) => {
			if (args[0] === 'rev-parse') return { status: 0, stdout: '/repo\n' };
			return { status: 128, stdout: '', stderr: 'missing path' };
		});

		expect(getFileContentAtCommit('hash', 'content/missing.md')).toBe('');
	});
});

describe('git commit history rename tracking', () => {
	it('uses each historical path across a rename chain', async () => {
		mockHistory(
			[
				gitCommit('newest', 30, ['M', 'content/final.md']),
				gitCommit('rename-final', 20, ['R100', 'content/middle.md', 'content/final.md']),
				gitCommit('rename-middle', 10, ['R100', 'content/original.md', 'content/middle.md']),
				gitCommit('initial', 5, ['A', 'content/original.md']),
			].join(''),
			'content/final.md\0'
		);
		setProjectRoot('/repo/content');

		const entries = await collectGitInfoForContentFiles();
		const entry = entries.find(([file]) => file === 'final.md');
		expect(entry).toBeDefined();
		expect(entry![1].commits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ hash: 'newest', repoPath: 'content/final.md' }),
				expect.objectContaining({ hash: 'rename-final', repoPath: 'content/final.md' }),
				expect.objectContaining({ hash: 'rename-middle', repoPath: 'content/middle.md' }),
				expect.objectContaining({ hash: 'initial', repoPath: 'content/original.md' }),
			])
		);
		expect(entry![1].commits).toHaveLength(4);
		expect(entry![1]).toMatchObject({
			earliest: 5000,
			latest: 30000,
			authors: [{ name: 'Test Author', email: 'test@example.com' }],
		});
	});

	it('stops rename ancestry when a reused path is added as a new lifetime', async () => {
		mockHistory(
			[
				gitCommit('rename-final', 60, ['R100', 'content/reused.md', 'content/final.md']),
				gitCommit('reused-add', 50, ['A', 'content/reused.md']),
				gitCommit('reused-delete', 40, ['D', 'content/reused.md']),
				gitCommit('old-rename', 30, ['R100', 'content/original.md', 'content/reused.md']),
				gitCommit('old-add', 20, ['A', 'content/original.md']),
			].join(''),
			'content/final.md\0'
		);
		setProjectRoot('/repo/content');

		const entries = await collectGitInfoForContentFiles();
		const entry = entries.find(([file]) => file === 'final.md');
		expect(entry?.[1].commits).toEqual([
			expect.objectContaining({ hash: 'rename-final', repoPath: 'content/final.md' }),
			expect.objectContaining({ hash: 'reused-add', repoPath: 'content/reused.md' }),
		]);
	});

	it('treats copies as a new path lifetime instead of rename ancestry', async () => {
		mockHistory(
			[
				gitCommit('copy', 30, ['C100', 'content/original.md', 'content/copied.md']),
				gitCommit('original-change', 20, ['M', 'content/original.md']),
				gitCommit('original-add', 10, ['A', 'content/original.md']),
			].join(''),
			'content/copied.md\0'
		);
		setProjectRoot('/repo/content');

		const entries = await collectGitInfoForContentFiles();
		const entry = entries.find(([file]) => file === 'copied.md');
		expect(entry?.[1].commits).toEqual([
			expect.objectContaining({ hash: 'copy', repoPath: 'content/copied.md' }),
		]);
	});

	it('uses an unlimited buffer for repository-wide history and tracked paths', async () => {
		mockHistory(gitCommit('only', 10, ['M', 'content/entry.md']), 'content/entry.md\0');
		setProjectRoot('/repo/content');

		await collectGitInfoForContentFiles();

		for (const command of ['log', 'ls-files']) {
			const [, , options] = childProcess.spawnSync.mock.calls.find(
				([, args]) => args[0] === command
			)!;
			expect(options.maxBuffer).toBe(Number.MAX_SAFE_INTEGER);
		}
	});

	it('does not pay rename-discovery cost when commit history is disabled', async () => {
		mockHistory(gitCommit('only', 10, ['M', 'content/entry.md']), 'content/entry.md\0');
		setProjectRoot('/repo/content');
		setCollectCommitHistory(false);

		const entries = await collectGitInfoForContentFiles();
		expect(entries).toHaveLength(1);
		expect(entries[0][1].commits).toEqual([]);
		expect(childProcess.spawnSync.mock.calls.some(([, args]) => args[0] === 'ls-files')).toBe(
			false
		);
		const [, args] = childProcess.spawnSync.mock.calls.find(([, args]) => args[0] === 'log')!;
		expect(args).not.toContain('--find-renames');
		expect(args).toContain('/repo/content');
	});
});
