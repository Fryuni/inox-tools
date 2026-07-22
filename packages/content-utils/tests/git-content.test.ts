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

function createRepository(): string {
	repository = mkdtempSync(join(tmpdir(), 'content-utils-git-'));
	execFileSync('git', ['init', '--quiet'], { cwd: repository });
	execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repository });
	execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repository });
	return repository;
}

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

	it('follows a side-parent modification through a rename merge', async () => {
		const repo = createRepository();
		const path = 'entry.md';
		const renamedPath = 'renamed.md';
		const initialContent = Array.from({ length: 100 }, (_, index) => `line ${index}`).join('\n');
		writeFileSync(join(repo, path), initialContent, 'utf-8');
		execFileSync('git', ['add', path], { cwd: repo });
		execFileSync('git', ['commit', '--quiet', '-m', 'Add entry'], { cwd: repo });
		const initialHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['checkout', '--quiet', '-b', 'side'], { cwd: repo });
		const sideContent = initialContent.replace('line 50', 'side change');
		writeFileSync(join(repo, path), sideContent, 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Modify entry on side'], {
			cwd: repo,
		});
		const sideHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['checkout', '--quiet', '-'], { cwd: repo });
		renameSync(join(repo, path), join(repo, renamedPath));
		execFileSync('git', ['add', '--all'], { cwd: repo });
		execFileSync('git', ['commit', '--quiet', '-m', 'Rename entry'], { cwd: repo });
		const renameHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['merge', '--no-ff', 'side', '--no-edit'], { cwd: repo });
		const mergeHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		setProjectRoot(repo);
		const entry = (await collectGitInfoForContentFiles()).find(([file]) => file === renamedPath);
		const commits = entry?.[1].commits ?? [];

		expect(commits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ hash: initialHash, repoPath: path }),
				expect.objectContaining({ hash: sideHash, repoPath: path }),
				expect.objectContaining({ hash: renameHash, repoPath: renamedPath }),
				expect.objectContaining({ hash: mergeHash, repoPath: renamedPath }),
			])
		);
		expect(commits.filter((commit) => commit.hash === mergeHash)).toHaveLength(1);
	});

	it('includes a conflict-resolution merge exactly once at its resolved path', async () => {
		const repo = createRepository();
		const path = 'entry.md';
		writeFileSync(join(repo, path), 'original content', 'utf-8');
		execFileSync('git', ['add', path], { cwd: repo });
		execFileSync('git', ['commit', '--quiet', '-m', 'Add entry'], { cwd: repo });
		const initialHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['checkout', '--quiet', '-b', 'side'], { cwd: repo });
		writeFileSync(join(repo, path), 'side content', 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Modify entry on side'], {
			cwd: repo,
		});
		const sideHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['checkout', '--quiet', '-'], { cwd: repo });
		writeFileSync(join(repo, path), 'main content', 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Modify entry on main'], {
			cwd: repo,
		});
		const mainHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		expect(() => execFileSync('git', ['merge', '--no-ff', 'side'], { cwd: repo })).toThrow();
		writeFileSync(join(repo, path), 'side content', 'utf-8');
		execFileSync('git', ['add', path], { cwd: repo });
		execFileSync('git', ['commit', '--quiet', '-m', 'Resolve merge'], { cwd: repo });
		const mergeHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		setProjectRoot(repo);
		const entry = (await collectGitInfoForContentFiles()).find(([file]) => file === path);
		const commits = entry?.[1].commits ?? [];
		const mergeCommit = commits.find((commit) => commit.hash === mergeHash);

		expect(commits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ hash: initialHash }),
				expect.objectContaining({ hash: sideHash }),
				expect.objectContaining({ hash: mainHash }),
				expect.objectContaining({ hash: mergeHash, repoPath: path }),
			])
		);
		expect(commits.filter((commit) => commit.hash === mergeHash)).toHaveLength(1);
		expect(getFileContentAtCommit(mergeHash, mergeCommit!.repoPath)).toBe('side content');
	});

	it('deduplicates an automatic merge that changes a file against both parents', async () => {
		const repo = createRepository();
		const path = 'entry.md';
		writeFileSync(join(repo, path), 'first\nmiddle\nlast', 'utf-8');
		execFileSync('git', ['add', path], { cwd: repo });
		execFileSync('git', ['commit', '--quiet', '-m', 'Add entry'], { cwd: repo });

		execFileSync('git', ['checkout', '--quiet', '-b', 'side'], { cwd: repo });
		writeFileSync(join(repo, path), 'first\nmiddle\nside last', 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Modify last line on side'], {
			cwd: repo,
		});
		const sideHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['checkout', '--quiet', '-'], { cwd: repo });
		writeFileSync(join(repo, path), 'main first\nmiddle\nlast', 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Modify first line on main'], {
			cwd: repo,
		});
		const mainHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['merge', '--no-ff', 'side', '--no-edit'], { cwd: repo });
		const mergeHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		setProjectRoot(repo);
		const entry = (await collectGitInfoForContentFiles()).find(([file]) => file === path);
		const commits = entry?.[1].commits ?? [];

		expect(commits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ hash: sideHash }),
				expect.objectContaining({ hash: mainHash }),
				expect.objectContaining({ hash: mergeHash, repoPath: path }),
			])
		);
		expect(commits.filter((commit) => commit.hash === mergeHash)).toHaveLength(1);
	});

	it('traverses both parents when a merge has no file diff', async () => {
		const repo = createRepository();
		const path = 'entry.md';
		writeFileSync(join(repo, path), 'original content', 'utf-8');
		execFileSync('git', ['add', path], { cwd: repo });
		execFileSync('git', ['commit', '--quiet', '-m', 'Add entry'], { cwd: repo });

		execFileSync('git', ['checkout', '--quiet', '-b', 'side'], { cwd: repo });
		writeFileSync(join(repo, path), 'side content', 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Modify entry on side'], {
			cwd: repo,
		});
		const sideChangeHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();
		writeFileSync(join(repo, path), 'original content', 'utf-8');
		execFileSync('git', ['commit', '--all', '--quiet', '-m', 'Restore entry on side'], {
			cwd: repo,
		});
		const sideRestoreHash = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repo,
			encoding: 'utf-8',
		}).trim();

		execFileSync('git', ['checkout', '--quiet', '-'], { cwd: repo });
		execFileSync('git', ['commit', '--allow-empty', '--quiet', '-m', 'Empty main commit'], {
			cwd: repo,
		});
		execFileSync('git', ['merge', '--no-ff', 'side', '--no-edit'], { cwd: repo });

		setProjectRoot(repo);
		const entry = (await collectGitInfoForContentFiles()).find(([file]) => file === path);

		expect(entry?.[1].commits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ hash: sideChangeHash }),
				expect.objectContaining({ hash: sideRestoreHash }),
			])
		);
	});
});
