import { afterEach, describe, expect, it, vi } from 'vitest';

const childProcess = vi.hoisted(() => ({
	spawnSync: vi.fn(),
}));

vi.mock('node:child_process', () => childProcess);

import { getFileContentAtCommit, setProjectRoot } from '../src/runtime/git.js';

function repoRootCalls() {
	return childProcess.spawnSync.mock.calls.filter(([, args]) => args[0] === 'rev-parse');
}

afterEach(() => {
	childProcess.spawnSync.mockReset();
	setProjectRoot(process.cwd());
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
