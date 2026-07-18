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
	existingRedirects: Record<string, string> = {},
	srcDir = 'src'
) {
	const integration = gitRedirect(sources);
	const hook = integration.hooks['astro:config:setup'];
	const updates: Array<{ redirects?: Record<string, string> }> = [];

	expect(hook).toBeDefined();
	await hook?.({
		config: {
			redirects: existingRedirects,
			root: pathToFileURL(`${repository}/`),
			srcDir: pathToFileURL(`${repository}/${srcDir}/`),
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

	test('does not redirect an older lifetime after its path is reused and deleted', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/old.md', '# Original');
			await commit(repository, 'add original page');

			await moveFile(repository, 'pages/old.md', 'pages/current.md');
			await commit(repository, 'rename original page');

			await createFile(repository, 'pages/old.md', '# Replacement');
			await commit(repository, 'reuse old path');

			await rm(join(repository, 'pages/old.md'));
			await commit(repository, 'delete replacement page');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({});
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

	test('excludes underscore-prefixed files in a custom Astro pages directory', async () => {
		await withRepository(async (repository) => {
			const srcDir = 'application';
			const pages = `${srcDir}/pages`;
			await createFile(repository, `${pages}/old.md`, '# Old');
			await commit(repository, 'add page');

			await moveFile(repository, `${pages}/old.md`, `${pages}/_draft.md`);
			await commit(repository, 'move page to draft');

			await expect(
				resolveRedirects(repository, [{ path: pages, prefix: '/docs' }], {}, srcDir)
			).resolves.toEqual({});
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

	test('keeps rename chains within their original path lifetime', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/a.md', '# Original');
			await commit(repository, 'add original page');

			await moveFile(repository, 'pages/a.md', 'pages/b.md');
			await commit(repository, 'rename original page once');

			await moveFile(repository, 'pages/b.md', 'pages/c.md');
			await commit(repository, 'rename original page twice');

			await createFile(repository, 'pages/b.md', '# Replacement');
			await commit(repository, 'reuse intermediate path');

			await moveFile(repository, 'pages/b.md', 'pages/d.md');
			await commit(repository, 'rename replacement page');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({
				'/docs/a': '/docs/c',
				'/docs/b': '/docs/d',
			});
		});
	});

	test('only redirects dynamic routes with identical parameter bindings', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/renamed/[id].md', '# Renamed parameter');
			await createFile(repository, 'pages/static/[id].md', '# Static parameter');
			await createFile(repository, 'pages/rest/[...parts].md', '# Rest parameter');
			await createFile(repository, 'pages/same/[id]/old.md', '# Compatible parameter');
			await commit(repository, 'add dynamic pages');

			await moveFile(repository, 'pages/renamed/[id].md', 'pages/renamed/[slug].md');
			await moveFile(repository, 'pages/static/[id].md', 'pages/static/current.md');
			await moveFile(repository, 'pages/rest/[...parts].md', 'pages/rest/[parts].md');
			await moveFile(repository, 'pages/same/[id]/old.md', 'pages/same/[id]/current.md');
			await commit(repository, 'rename dynamic pages');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({
				'/docs/same/[id]/old': '/docs/same/[id]/current',
			});
		});
	});

	test('rejects shallow repositories with fetch-depth guidance', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/current.md', '# Current');
			await commit(repository, 'add current page');

			const shallowRepository = join(repository, 'shallow');
			await git(
				repository,
				'clone',
				'--depth=1',
				pathToFileURL(repository).href,
				shallowRepository
			);

			await expect(
				resolveRedirects(shallowRepository, [{ path: 'pages', prefix: '/docs' }])
			).rejects.toThrow(/fetch-depth:\s*0/i);
		});
	});

	test('does not shadow recreated sibling routes for configured files', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/old.md', '# Old');
			await commit(repository, 'add old page');

			await moveFile(repository, 'pages/old.md', 'pages/current.md');
			await commit(repository, 'rename page');

			await createFile(repository, 'pages/old.md', '# Replacement');
			await commit(repository, 'recreate sibling page');

			await expect(
				resolveRedirects(repository, [{ path: 'pages/current.md', prefix: '/docs' }])
			).resolves.toEqual({});
		});
	});

	test('finds renames introduced by first-parent merge resolution', async () => {
		await withRepository(async (repository) => {
			const sharedContent = 'Shared content that makes this a detected rename.\n'.repeat(20);
			await createFile(repository, 'pages/old.md', sharedContent);
			await commit(repository, 'add original page');

			await git(repository, 'checkout', '-b', 'feature');
			await createFile(repository, 'pages/old.md', `Feature branch\n${sharedContent}`);
			await commit(repository, 'change page on feature branch');

			await git(repository, 'checkout', 'main');
			await createFile(repository, 'pages/old.md', `Main branch\n${sharedContent}`);
			await commit(repository, 'change page on main branch');

			await expect(git(repository, 'merge', '--no-commit', 'feature')).rejects.toThrow();
			await git(repository, 'rm', '--force', 'pages/old.md');
			await createFile(repository, 'pages/current.md', sharedContent);
			await commit(repository, 'resolve merge by renaming page');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({
				'/docs/old': '/docs/current',
			});
		});
	});

	test('requires nested repositories to be configured separately', async () => {
		await withRepository(async (repository) => {
			await createFile(repository, 'pages/nested/old.md', '# Parent page');
			await commit(repository, 'add parent page');

			await moveFile(repository, 'pages/nested/old.md', 'pages/nested/current.md');
			await commit(repository, 'rename parent page');

			const nestedRepository = join(repository, 'pages/nested');
			await rm(nestedRepository, { recursive: true });
			await mkdir(nestedRepository, { recursive: true });
			await git(nestedRepository, 'init', '--initial-branch=main');
			await git(nestedRepository, 'config', 'user.email', 'tests@inox.tools');
			await git(nestedRepository, 'config', 'user.name', 'Inox Tests');
			await createFile(nestedRepository, 'old.md', '# Nested page');
			await commit(nestedRepository, 'add nested page');
			await moveFile(nestedRepository, 'old.md', 'current.md');
			await commit(nestedRepository, 'rename nested page');
			await commit(repository, 'replace directory with nested repository');

			await expect(
				resolveRedirects(repository, [{ path: 'pages', prefix: '/docs' }])
			).resolves.toEqual({});
			await expect(
				resolveRedirects(repository, [{ path: 'pages/nested', prefix: '/docs' }])
			).resolves.toEqual({
				'/docs/old': '/docs/current',
			});
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
