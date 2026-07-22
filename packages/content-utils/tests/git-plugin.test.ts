import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as devalue from 'devalue';
import { parseAst, type Plugin } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationState } from '../src/integration/state.js';

const git = vi.hoisted(() => ({
	collectGitInfoForContentFiles: vi.fn(),
	getFileContentAtCommit: vi.fn(),
	setCollectCommitHistory: vi.fn(),
	setProjectRoot: vi.fn(),
}));

vi.mock('../src/runtime/git.js', () => git);

import { gitBuildPlugin } from '../src/integration/gitPlugin.js';

let temporaryDirectory: string | undefined;

afterEach(() => {
	if (temporaryDirectory) rmSync(temporaryDirectory, { force: true, recursive: true });
	temporaryDirectory = undefined;
	vi.resetAllMocks();
});

function createState(): IntegrationState {
	return {
		cleanups: [],
		collectCommitHistory: true,
		staticOnlyCollections: [],
		contentPaths: {
			configExists: true,
			configPath: '',
			contentPath: '',
			projectRoot: '/project',
			resolve: (path) => path,
		},
	} as IntegrationState;
}

describe('gitBuildPlugin', () => {
	it('materializes only commits for content entries retained after cleanup', async () => {
		const state = createState();
		const plugin = gitBuildPlugin(state);
		const trackedFiles = new Map([
			[
				'entry.md',
				{
					authors: [],
					coAuthors: [],
					commits: [
						{ hash: 'entry-first', repoPath: 'content/entry.md' },
						{ hash: 'entry-second', repoPath: 'content/entry.md' },
					],
					earliest: 1,
					latest: 2,
				},
			],
			[
				'irrelevant.md',
				{
					authors: [],
					coAuthors: [],
					commits: [
						{ hash: 'irrelevant-one', repoPath: 'content/irrelevant.md' },
						{ hash: 'irrelevant-two', repoPath: 'content/irrelevant.md' },
						{ hash: 'irrelevant-three', repoPath: 'content/irrelevant.md' },
					],
					earliest: 1,
					latest: 3,
				},
			],
		]);
		git.collectGitInfoForContentFiles.mockResolvedValue(trackedFiles);
		git.getFileContentAtCommit.mockImplementation((hash, repoPath) => `${hash}:${repoPath}`);

		const load = plugin.load as (id: string, options: { ssr: boolean }) => Promise<string>;
		const initialState = await load('\x00@it-astro:content/git/internal', { ssr: true });

		expect(git.getFileContentAtCommit).not.toHaveBeenCalled();

		temporaryDirectory = mkdtempSync(join(tmpdir(), 'content-utils-git-plugin-'));
		const gitStatePath = join(temporaryDirectory, 'git-state.mjs');
		const contentDataPath = join(temporaryDirectory, 'content-data.mjs');
		writeFileSync(gitStatePath, initialState);
		writeFileSync(
			contentDataPath,
			`export default ${devalue.stringify(
				new Map([
					[
						'blog',
						new Map([
							['entry', { filePath: 'entry.md' }],
							['irrelevant', { filePath: 'irrelevant.md' }],
						]),
					],
				])
			)};`
		);
		// Prime the runtime module cache to reproduce static-collection cleanup importing this chunk.
		await import(pathToFileURL(contentDataPath).href);
		writeFileSync(
			contentDataPath,
			`export default ${devalue.stringify(
				new Map([['blog', new Map([['entry', { filePath: 'entry.md' }]])]])
			)};`
		);

		const writeBundle = plugin.writeBundle as NonNullable<Plugin['writeBundle']>;
		writeBundle(
			{ dir: temporaryDirectory } as Parameters<typeof writeBundle>[0],
			{
				'content-data.mjs': {
					fileName: 'content-data.mjs',
					moduleIds: ['\0astro:data-layer-content'],
					type: 'chunk',
				},
				'git-state.mjs': {
					fileName: 'git-state.mjs',
					moduleIds: ['\x00@it-astro:content/git/internal'],
					type: 'chunk',
				},
			} as Parameters<typeof writeBundle>[1]
		);
		await state.cleanups[0]();

		expect(git.getFileContentAtCommit).toHaveBeenCalledTimes(2);
		expect(git.getFileContentAtCommit).toHaveBeenNthCalledWith(
			1,
			'entry-first',
			'content/entry.md'
		);
		expect(git.getFileContentAtCommit).toHaveBeenNthCalledWith(
			2,
			'entry-second',
			'content/entry.md'
		);
		expect(readFileSync(gitStatePath, 'utf-8')).not.toContain('content/irrelevant.md');

		// The cleanup imports this module before rewriting it, so the query avoids its cached initial state.
		const { default: storedState } = await import(`${pathToFileURL(gitStatePath).href}?finalized`);
		const finalizedFiles: Map<string, { commits: Array<Record<string, unknown>> }> =
			devalue.unflatten(storedState);
		expect(finalizedFiles).toHaveLength(1);
		expect(finalizedFiles.get('entry.md')?.commits).toEqual([
			{ content: 'entry-first:content/entry.md', hash: 'entry-first' },
			{ content: 'entry-second:content/entry.md', hash: 'entry-second' },
		]);
	});

	it('materializes commit content without replacing a combined output chunk', async () => {
		const state = createState();
		const plugin = gitBuildPlugin(state);
		git.collectGitInfoForContentFiles.mockResolvedValue(
			new Map([
				[
					'café.md',
					{
						authors: [],
						coAuthors: [],
						commits: [{ hash: 'entry', repoPath: 'content/café.md' }],
						earliest: 1,
						latest: 1,
					},
				],
			])
		);
		git.getFileContentAtCommit.mockReturnValue('café history');

		const transform = plugin.transform as NonNullable<Plugin['transform']>;
		await transform.call(
			{ parse: parseAst } as Parameters<typeof transform.call>[0],
			`export default${devalue.stringify(
				new Map([
					[
						'blog',
						new Map([
							[
								'entry',
								{
									body: 'export default function example() {}',
									filePath: 'café.md',
								},
							],
						]),
					],
				])
			)};`,
			'\0astro:data-layer-content'
		);

		const load = plugin.load as (id: string, options: { ssr: boolean }) => Promise<string>;
		const initialState = await load('\x00@it-astro:content/git/internal', { ssr: true });

		temporaryDirectory = mkdtempSync(join(tmpdir(), 'content-utils-git-plugin-'));
		const combinedPath = join(temporaryDirectory, 'combined.mjs');
		writeFileSync(combinedPath, `const preserved = true;\n${initialState}\nexport { preserved };`);

		const writeBundle = plugin.writeBundle as NonNullable<Plugin['writeBundle']>;
		writeBundle(
			{ dir: temporaryDirectory } as Parameters<typeof writeBundle>[0],
			{
				'combined.mjs': {
					fileName: 'combined.mjs',
					moduleIds: ['\x00@it-astro:content/git/internal', '\0astro:data-layer-content', 'entry'],
					type: 'chunk',
				},
			} as Parameters<typeof writeBundle>[1]
		);
		await state.cleanups[0]();

		const finalizedSource = readFileSync(combinedPath, 'utf-8');
		expect(finalizedSource).toContain('const preserved = true');
		// Import the generated output to exercise its runtime UTF-8 decoder.
		const { default: flattenedState } = await import(
			`${pathToFileURL(combinedPath).href}?finalized`
		);
		const finalizedState: Map<string, { commits: Array<Record<string, unknown>> }> =
			devalue.unflatten(flattenedState);
		expect(finalizedState.get('café.md')?.commits).toEqual([
			{ content: 'café history', hash: 'entry' },
		]);
	});
});
