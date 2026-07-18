import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import gitRedirect, { type GitRedirectSource } from '../src/index.js';

const execFileAsync = promisify(execFile);

async function git(repository: string, ...args: string[]) {
	await execFileAsync('git', args, { cwd: repository });
}

async function createFile(repository: string, file: string, content: string) {
	const path = join(repository, file);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content);
}

async function commit(repository: string, message: string) {
	await git(repository, 'add', '--all');
	await git(repository, 'commit', '--message', message);
}

async function moveFile(repository: string, from: string, to: string) {
	await mkdir(dirname(join(repository, to)), { recursive: true });
	await git(repository, 'mv', from, to);
}

async function withRepository(callback: (repository: string) => Promise<void>) {
	const repository = await mkdtemp(join(tmpdir(), 'inox-git-redirect-'));

	try {
		await git(repository, 'init', '--initial-branch=main');
		await git(repository, 'config', 'user.email', 'tests@inox.tools');
		await git(repository, 'config', 'user.name', 'Inox Tests');
		await callback(repository);
	} finally {
		await rm(repository, { recursive: true, force: true });
	}
}

async function resolveRedirects(
	repository: string,
	sources: GitRedirectSource[],
	existingRedirects: Record<string, string> = {}
) {
	const integration = gitRedirect(sources);
	const hook = integration.hooks['astro:config:setup'];
	const updates: Array<{ redirects?: Record<string, string> }> = [];

	expect(hook).toBeDefined();
	await hook?.({
		config: {
			redirects: existingRedirects,
			root: pathToFileURL(`${repository}/`),
		},
		updateConfig: (update: { redirects?: Record<string, string> }) => updates.push(update),
	} as never);

	return updates.reduce((redirects, update) => Object.assign(redirects, update.redirects), {
		...existingRedirects,
	});
}

describe('gitRedirect', () => {
	test('creates redirects for renamed Astro, Markdown, and MDX files', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'content/astro/old.astro', '<h1>Astro</h1>');
			await createFile(repository, 'content/markdown/old.md', '# Markdown');
			await createFile(repository, 'content/mdx/old.mdx', '# MDX');
			await commit(repository, 'add original pages');

			await moveFile(repository, 'content/astro/old.astro', 'content/astro/current.astro');
			await moveFile(repository, 'content/markdown/old.md', 'content/markdown/current.md');
			await moveFile(repository, 'content/mdx/old.mdx', 'content/mdx/current.mdx');
			await commit(repository, 'rename pages');

			await expect(
				resolveRedirects(repository, [{ path: 'content', prefix: '/guides/' }])
			).resolves.toEqual({
				'/guides/astro/old': '/guides/astro/current',
				'/guides/markdown/old': '/guides/markdown/current',
				'/guides/mdx/old': '/guides/mdx/current',
			});
		});
	});

	test('follows rename chains to the current file', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/original.astro', '<h1>Original</h1>');
			await commit(repository, 'add original page');

			await moveFile(repository, 'pages/original.astro', 'pages/intermediate.astro');
			await commit(repository, 'rename page once');

			await moveFile(repository, 'pages/intermediate.astro', 'pages/current.mdx');
			await commit(repository, 'rename page twice');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({
				'/docs/original': '/docs/current',
				'/docs/intermediate': '/docs/current',
			});
		});
	});

	test('uses the latest rename when a historical path is reused', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/reused.md', '# Original');
			await commit(repository, 'add original page');

			await moveFile(repository, 'pages/reused.md', 'pages/first-current.md');
			await commit(repository, 'rename original page');

			await createFile(repository, 'pages/reused.md', '# Replacement');
			await commit(repository, 'reuse original path');

			await moveFile(repository, 'pages/reused.md', 'pages/latest-current.md');
			await commit(repository, 'rename replacement page');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({
				'/docs/reused': '/docs/latest-current',
			});
		});
	});

	test('accepts a current file as the configured source path', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/old.mdx', '# Old');
			await commit(repository, 'add old page');

			await moveFile(repository, 'pages/old.mdx', 'pages/current.mdx');
			await commit(repository, 'rename page');

			await expect(
				resolveRedirects(repository, [{ path: 'pages/current.mdx', prefix: '/docs' }])
			).resolves.toEqual({
				'/docs/old': '/docs/current',
			});
		});
	});

	test('normalizes prefixes and collapses terminal index routes', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/previous/index.md', '# Previous');
			await commit(repository, 'add previous index');

			await moveFile(repository, 'pages/previous/index.md', 'pages/index.mdx');
			await commit(repository, 'move index to root');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '///docs//' }])
			).resolves.toEqual({
				'/docs/previous': '/docs',
			});
		});
	});

	test('skips unsupported sources and URLs that are still current files', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/unsupported.txt', 'unsupported');
			await createFile(repository, 'pages/old.astro', '<h1>Old</h1>');
			await commit(repository, 'add pages');

			await moveFile(repository, 'pages/unsupported.txt', 'pages/supported.astro');
			await moveFile(repository, 'pages/old.astro', 'pages/new.astro');
			await commit(repository, 'rename pages');

			await createFile(repository, 'pages/old.astro', '<h1>Replacement</h1>');
			await commit(repository, 'restore old URL');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({});
		});
	});

	test('does not redirect a URL served by another configured source', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'first/page.md', '# Historical');
			await createFile(repository, 'second/page.md', '# Current');
			await commit(repository, 'add pages');

			await moveFile(repository, 'first/page.md', 'first/renamed.md');
			await commit(repository, 'rename historical page');

			await expect(
				resolveRedirects(repository, [
					{ path: 'first', prefix: '/docs' },
					{ path: 'second', prefix: '/docs' },
				])
			).resolves.toEqual({});
		});
	});

	test('preserves explicit Astro redirects on collisions', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/old.astro', '<h1>Old</h1>');
			await commit(repository, 'add old page');

			await moveFile(repository, 'pages/old.astro', 'pages/generated.astro');
			await commit(repository, 'rename page');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/' }], { '/old': '/manual' })
			).resolves.toEqual({ '/old': '/manual' });
		});
	});

	test('gives earlier sources precedence when generated redirects collide', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'first/old.astro', '<h1>First</h1>');
			await createFile(repository, 'second/old.astro', '<h1>Second</h1>');
			await commit(repository, 'add old pages');

			await moveFile(repository, 'first/old.astro', 'first/first-current.astro');
			await moveFile(repository, 'second/old.astro', 'second/second-current.astro');
			await commit(repository, 'rename pages');

			await expect(
				resolveRedirects(repository, [
					{ path: 'first', prefix: '/docs' },
					{ path: 'second', prefix: '/docs' },
				])
			).resolves.toEqual({ '/docs/old': '/docs/first-current' });
		});
	});

	test('reports source paths outside a Git repository', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'inox-git-redirect-no-repository-'));

		try {
			await createFile(directory, 'pages/current.astro', '<h1>Current</h1>');
			await expect(resolveRedirects(directory, [{ path: 'pages', prefix: '/' }])).rejects.toThrow(
				/\b(git|repository)\b/i
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
