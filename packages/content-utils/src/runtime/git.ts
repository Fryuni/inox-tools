import { spawnSync } from 'node:child_process';
import { sep, resolve, relative } from 'node:path';
import { hooks } from '@inox-tools/modular-station/hooks';
import { Lazy } from '@inox-tools/utils/lazy';
import { getDebug } from '../internal/debug.js';
import type { GitTrackingInfo, CommitInfo } from '@it-astro:content/git';

let projectRoot: string = process.cwd();
let collectCommitHistory: boolean = true;

const debug = getDebug('git');

/**
 * @internal
 */
export function setProjectRoot(path: string) {
	projectRoot = path;
}

/**
 * @internal
 */
export function setCollectCommitHistory(value: boolean) {
	collectCommitHistory = value;
}

function getRepoRoot(): string {
	debug('Retrieving git repo root', { projectRoot });
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
		cwd: projectRoot,
		encoding: 'utf-8',
	});

	if (result.error) {
		debug(`Failed to retrieve repo root:`, result.error, result.stderr);
		debug('Falling back to contentPath:', projectRoot);
		return projectRoot;
	}

	return result.stdout.trim();
}

/**
 * @internal
 */
export function getFileContentAtCommit(hash: string, repoPath: string): string {
	const result = spawnSync('git', ['show', `${hash}:${repoPath}`], {
		cwd: getRepoRoot(),
		encoding: 'utf-8',
	});

	if (result.error || result.status !== 0) {
		debug('Failed to retrieve file content at commit:', hash, repoPath, result.stderr);
		return '';
	}

	return result.stdout;
}

export type GitAuthor = {
	name: string;
	email: string;
};

export type RawCommitInfo = {
	hash: string;
	date: number;
	author: GitAuthor;
	coAuthors: GitAuthor[];
	repoPath: string;
};

type RawGitTrackingInfo = {
	earliest: number;
	latest: number;
	authors: GitAuthor[];
	coAuthors: GitAuthor[];
	commits: RawCommitInfo[];
};

/**
 * @internal
 */
export async function collectGitInfoForContentFiles(): Promise<[string, RawGitTrackingInfo][]> {
	const repoRoot = getRepoRoot();

	const args = [
		'log',
		'--format=t:%H %ct %an <%ae>|%(trailers:key=co-authored-by,valueonly,separator=|)',
		'--name-status',
		'--',
		projectRoot,
	];

	debug('Retrieving content git log:', args.join(' '));
	const gitLog = spawnSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf-8',
	});

	if (gitLog.error) {
		debug('Failed to retrieve content git log:', gitLog.error, gitLog.stderr);
		return [];
	}

	const parsingState = {
		hash: '',
		date: 0,
		author: <GitAuthor>{ name: '', email: '' },
		coAuthors: <GitAuthor[]>[],
	};

	const fileInfos = new Map<string, RawGitTrackingInfo>();

	for (const logLine of gitLog.stdout.split('\n')) {
		if (logLine.startsWith('t:')) {
			// t:<hash> <seconds since epoch> <author name> <author email>|<co-authors>
			const firstSpace = logLine.indexOf(' ');
			parsingState.hash = logLine.slice(2, firstSpace);

			const rest = logLine.slice(firstSpace + 1);
			const secondSpace = rest.indexOf(' ');
			parsingState.date = Number.parseInt(rest.slice(0, secondSpace)) * 1000;

			const authors = rest
				.slice(secondSpace + 1)
				.replace(/\|$/, '')
				.split('|')
				.map((author) => {
					const [name, email] = author.split('<');
					return {
						name: name.trim(),
						email: email.slice(0, -1),
					};
				});
			parsingState.author = authors[0];
			parsingState.coAuthors = authors.slice(1);

			continue;
		}

		// TODO: Track git time across renames and moves

		// - Added files take the format `A\t<file>`
		// - Modified files take the format `M\t<file>`
		// - Deleted files take the format `D\t<file>`
		// - Renamed files take the format `R<count>\t<old>\t<new>`
		// - Copied files take the format `C<count>\t<old>\t<new>`
		// The name of the file as of the commit being processed is always
		// the last part of the log line.
		const tabSplit = logLine.lastIndexOf('\t');
		if (tabSplit === -1) continue;
		const fileName = relative(projectRoot, resolve(repoRoot, logLine.slice(tabSplit + 1)));

		const fileInfo = fileInfos.get(fileName);

		if (fileInfo === undefined) {
			const newInfo: RawGitTrackingInfo = {
				earliest: parsingState.date,
				latest: parsingState.date,
				authors: [parsingState.author],
				coAuthors: [...parsingState.coAuthors],
				commits: [],
			};
			if (collectCommitHistory) {
				newInfo.commits.push({
					hash: parsingState.hash,
					date: parsingState.date,
					author: parsingState.author,
					coAuthors: [...parsingState.coAuthors],
					repoPath: logLine.slice(tabSplit + 1),
				});
			}
			fileInfos.set(fileName, newInfo);
			continue;
		}

		fileInfo.earliest = Math.min(fileInfo.earliest, parsingState.date);
		fileInfo.latest = Math.max(fileInfo.latest, parsingState.date);
		if (collectCommitHistory) {
			fileInfo.commits.push({
				hash: parsingState.hash,
				date: parsingState.date,
				author: parsingState.author,
				coAuthors: [...parsingState.coAuthors],
				repoPath: logLine.slice(tabSplit + 1),
			});
		}
	}

	debug('Invoking @it/content:git:listed hook', {
		trackedFiles: Array.from(fileInfos.keys()),
	});
	await hooks.run('@it/content:git:listed', (logger) => [
		{
			logger,
			trackedFiles: Array.from(fileInfos.keys()),
			ignoreFiles: (ignore) => {
				for (const file of ignore) {
					fileInfos.delete(file);
				}
			},
		},
	]);

	const result: [string, RawGitTrackingInfo][] = [];

	for (const [file, rawFileInfo] of fileInfos.entries()) {
		const fileInfo: GitTrackingInfo = {
			earliest: new Date(rawFileInfo.earliest),
			latest: new Date(rawFileInfo.latest),
			authors: rawFileInfo.authors,
			coAuthors: rawFileInfo.coAuthors,
			commits: rawFileInfo.commits.map((c) => {
				const ci: Record<string, unknown> = {
					hash: c.hash,
					date: new Date(c.date),
					author: c.author,
					coAuthors: c.coAuthors,
				};
				Object.defineProperty(ci, 'content', {
					get: Lazy.wrap(() => getFileContentAtCommit(c.hash, c.repoPath)),
					enumerable: true,
				});
				return ci as CommitInfo;
			}),
		};

		let dropped = false;

		debug('Invoking @it/content:git:resolved hook', {
			file,
			fileInfo,
		});
		await hooks.run('@it/content:git:resolved', (logger) => [
			{
				logger,
				file,
				fileInfo,
				drop: () => {
					dropped = true;
				},
			},
		]);

		if (dropped) continue;

		rawFileInfo.earliest = fileInfo.earliest.valueOf();
		rawFileInfo.latest = fileInfo.latest.valueOf();

		result.push([file, rawFileInfo]);
	}

	return result;
}
