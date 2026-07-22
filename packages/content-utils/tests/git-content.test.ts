import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const modularStation = vi.hoisted(() => ({
	hooks: {
		run: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('@inox-tools/modular-station/hooks', () => modularStation);
import {
	collectGitInfoForContentFiles,
	getFileContentAtCommit,
	setProjectRoot,
} from '../src/runtime/git.js';

let repository: string | undefined;

afterEach(() => {
	setProjectRoot(process.cwd());
	if (repository !== undefined) rmSync(repository, { recursive: true, force: true });
	repository = undefined;
});

describe('git content retrieval', () => {
	it('reads committed UTF-8 content larger than Node’s default spawn buffer', () => {
		repository = mkdtempSync(join(tmpdir(), 'content-utils-git-'));
		execFileSync('git', ['init', '--quiet'], { cwd: repository });
		execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repository });
		execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repository });

		const content = `title: large\n${'é'.repeat(600_000)}`;
		writeFileSync(join(repository, 'large.md'), content, 'utf-8');
		execFileSync('git', ['add', 'large.md'], { cwd: repository });
		execFileSync('git', ['commit', '--quiet', '-m', 'Add large content'], { cwd: repository });
		const hash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repository,
			encoding: 'utf-8',
		}).trim();

		setProjectRoot(repository);
		expect(getFileContentAtCommit(hash, 'large.md')).toBe(content);
	});

	it('follows an actual rename through newline-containing paths', async () => {
		repository = mkdtempSync(join(tmpdir(), 'content-utils-git-'));
		execFileSync('git', ['init', '--quiet'], { cwd: repository });
		execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repository });
		execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repository });

		const contentDirectory = join(repository, 'content');
		const previousPath = 'before\nrename.md';
		const currentPath = 'after\nrename.md';
		mkdirSync(contentDirectory);
		writeFileSync(join(contentDirectory, previousPath), 'unchanged content', 'utf-8');
		execFileSync('git', ['add', '--all'], { cwd: repository });
		execFileSync('git', ['commit', '--quiet', '-m', 'Add content'], { cwd: repository });

		renameSync(join(contentDirectory, previousPath), join(contentDirectory, currentPath));
		execFileSync('git', ['add', '--all'], { cwd: repository });
		execFileSync('git', ['commit', '--quiet', '-m', 'Rename content'], { cwd: repository });

		setProjectRoot(contentDirectory);
		const entry = (await collectGitInfoForContentFiles()).find(([file]) => file === currentPath);

		expect(entry?.[1].commits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ repoPath: `content/${currentPath}` }),
				expect.objectContaining({ repoPath: `content/${previousPath}` }),
			])
		);
	});

	it('keeps Git log framing aligned across an empty commit and a t:-prefixed path', async () => {
		repository = mkdtempSync(join(tmpdir(), 'content-utils-git-'));
		execFileSync('git', ['init', '--quiet'], { cwd: repository });
		execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repository });
		execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repository });

		const path = 't:entry.md';
		writeFileSync(join(repository, path), 'first version', 'utf-8');
		execFileSync('git', ['add', path], { cwd: repository });
		execFileSync('git', ['commit', '--quiet', '-m', 'Add entry'], { cwd: repository });
		const initialHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repository,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['commit', '--allow-empty', '--quiet', '-m', 'Empty commit'], {
			cwd: repository,
		});

		writeFileSync(join(repository, path), 'second version', 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Update entry'], { cwd: repository });
		const latestHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repository,
			encoding: 'utf-8',
		}).trim();

		setProjectRoot(repository);
		const entry = (await collectGitInfoForContentFiles()).find(([file]) => file === path);

		expect(entry?.[1].commits).toEqual([
			expect.objectContaining({ hash: latestHash, repoPath: path }),
			expect.objectContaining({ hash: initialHash, repoPath: path }),
		]);
	});
});
