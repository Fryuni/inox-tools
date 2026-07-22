import { spawnSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { hooks } from '@inox-tools/modular-station/hooks';
import { Lazy } from '@inox-tools/utils/lazy';
import { getDebug } from '../internal/debug.js';
import type { GitTrackingInfo, CommitInfo } from '@it-astro:content/git';

let projectRoot: string = process.cwd();
let cachedRepoRoot: string | undefined;

let collectCommitHistory: boolean = true;

const debug = getDebug('git');

/**
 * @internal
 */
export function setProjectRoot(path: string) {
	projectRoot = path;
	cachedRepoRoot = undefined;
}

/**
 * @internal
 */
export function setCollectCommitHistory(value: boolean) {
	collectCommitHistory = value;
}

function getRepoRoot(): string {
	if (cachedRepoRoot !== undefined) return cachedRepoRoot;
	debug('Retrieving git repo root', { projectRoot });
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
		cwd: projectRoot,
		encoding: 'utf-8',
	});

	if (result.error) {
		debug(`Failed to retrieve repo root:`, result.error, result.stderr);
		debug('Falling back to contentPath:', projectRoot);
		cachedRepoRoot = projectRoot;
		return cachedRepoRoot;
	}

	cachedRepoRoot = result.stdout.trim();
	return cachedRepoRoot;
}

/**
 * @internal
 */
const maxGitContentBuffer = Number.MAX_SAFE_INTEGER;

export function getFileContentAtCommit(hash: string, repoPath: string): string {
	const result = spawnSync('git', ['show', `${hash}:${repoPath}`], {
		cwd: getRepoRoot(),
		encoding: 'utf-8',
		maxBuffer: maxGitContentBuffer,
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

/**
 * @internal
 */
export function createCommitInfo(commit: RawCommitInfo): CommitInfo {
	const commitInfo: Record<string, unknown> = {
		hash: commit.hash,
		date: new Date(commit.date),
		author: commit.author,
		coAuthors: Array.from(commit.coAuthors),
	};
	Object.defineProperty(commitInfo, 'content', {
		get: Lazy.wrap(() => getFileContentAtCommit(commit.hash, commit.repoPath)),
		enumerable: true,
	});
	return commitInfo as CommitInfo;
}

type RawGitTrackingInfo = {
	earliest: number;
	latest: number;
	authors: GitAuthor[];
	coAuthors: GitAuthor[];
	commits: RawCommitInfo[];
};

type GitLogEntry =
	| { kind: 'add' | 'copy' | 'delete' | 'change'; path: string }
	| { kind: 'rename'; from: string; to: string };

type GitLogCommit = {
	hash: string;
	date: number;
	author: GitAuthor;
	coAuthors: GitAuthor[];
	entries: GitLogEntry[];
};

type TrackedPath = {
	file: string;
	info: RawGitTrackingInfo | undefined;
};

function getCurrentRepoPaths(repoRoot: string): Map<string, TrackedPath> {
	const result = spawnSync('git', ['ls-files', '-z', '--', projectRoot], {
		cwd: repoRoot,
		encoding: 'utf-8',
		maxBuffer: maxGitContentBuffer,
	});
	if (result.error || result.status !== 0) {
		debug('Failed to retrieve current content files:', result.error, result.stderr);
		return new Map();
	}

	const paths = new Map<string, TrackedPath>();
	for (const repoPath of splitNulFields(result.stdout)) {
		if (!repoPath) continue;
		paths.set(repoPath, {
			file: relative(projectRoot, resolve(repoRoot, repoPath)),
			info: undefined,
		});
	}
	return paths;
}

function splitNulFields(output: string | Buffer): string[] {
	return (typeof output === 'string' ? output : output.toString('utf-8')).split('\0');
}

function parseCommitHeader(header: string): Omit<GitLogCommit, 'entries'> | undefined {
	if (!header.startsWith('t:')) return undefined;

	// t:<hash> <seconds since epoch> <author name> <author email>|<co-authors>
	const firstSpace = header.indexOf(' ');
	if (firstSpace === -1) return undefined;
	const hash = header.slice(2, firstSpace);

	const rest = header.slice(firstSpace + 1);
	const secondSpace = rest.indexOf(' ');
	if (secondSpace === -1) return undefined;
	const date = Number.parseInt(rest.slice(0, secondSpace)) * 1000;

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

	return {
		hash,
		date,
		author: authors[0],
		coAuthors: authors.slice(1),
	};
}

function parseGitLog(output: string | Buffer): GitLogCommit[] {
	const fields = splitNulFields(output);
	const commits: GitLogCommit[] = [];
	let index = 0;

	while (index < fields.length) {
		while (fields[index] === '') index += 1;
		if (index >= fields.length) break;

		const header = parseCommitHeader(fields[index]);
		if (header === undefined) {
			debug('Ignoring malformed git history entry:', fields[index]);
			break;
		}
		index += 1;

		const entries: GitLogEntry[] = [];
		while (index < fields.length) {
			if (fields[index] === '') {
				index += 1;
				continue;
			}
			if (fields[index].startsWith('t:')) break;

			// `git log --format=... --name-status -z` retains exactly one format-record
			// newline before every status token. A commit with no entries produces an
			// otherwise empty status token after that framing newline.
			const status = fields[index++].replace(/^\n/, '');
			if (status === '') continue;
			if (/^[RC]\d+$/.test(status)) {
				const from = fields[index++];
				const to = fields[index++];
				if (from === undefined || to === undefined) break;
				entries.push(
					status.startsWith('R') ? { kind: 'rename', from, to } : { kind: 'copy', path: to }
				);
				continue;
			}

			const path = fields[index++];
			if (path === undefined) break;
			if (status === 'A') entries.push({ kind: 'add', path });
			else if (status === 'D') entries.push({ kind: 'delete', path });
			else entries.push({ kind: 'change', path });
		}

		commits.push({ ...header, entries });
	}

	return commits;
}

function addCommit(
	trackedPath: TrackedPath,
	commit: GitLogCommit,
	repoPath: string,
	fileInfos: Map<string, RawGitTrackingInfo>
) {
	if (trackedPath.info === undefined) {
		trackedPath.info = {
			earliest: commit.date,
			latest: commit.date,
			authors: [commit.author],
			coAuthors: [...commit.coAuthors],
			commits: [],
		};
		fileInfos.set(trackedPath.file, trackedPath.info);
	} else {
		trackedPath.info.earliest = Math.min(trackedPath.info.earliest, commit.date);
		trackedPath.info.latest = Math.max(trackedPath.info.latest, commit.date);
	}

	if (collectCommitHistory) {
		trackedPath.info.commits.push({
			hash: commit.hash,
			date: commit.date,
			author: commit.author,
			coAuthors: [...commit.coAuthors],
			repoPath,
		});
	}
}

function collectHistory(
	commits: GitLogCommit[],
	currentPaths: Map<string, TrackedPath>
): Map<string, RawGitTrackingInfo> {
	let paths = currentPaths;
	const fileInfos = new Map<string, RawGitTrackingInfo>();

	for (const commit of commits) {
		const recorded = new Set<TrackedPath>();
		for (const entry of commit.entries) {
			const repoPath = entry.kind === 'rename' ? entry.to : entry.path;
			const trackedPath = paths.get(repoPath);
			if (trackedPath !== undefined && !recorded.has(trackedPath)) {
				addCommit(trackedPath, commit, repoPath, fileInfos);
				recorded.add(trackedPath);
			}
		}

		const before = new Map(paths);
		for (const entry of commit.entries) {
			if (entry.kind === 'add' || entry.kind === 'copy' || entry.kind === 'delete') {
				before.delete(entry.path);
			}
		}
		for (const entry of commit.entries) {
			if (entry.kind !== 'rename') continue;
			const trackedPath = paths.get(entry.to);
			before.delete(entry.to);
			if (trackedPath !== undefined) before.set(entry.from, trackedPath);
		}
		paths = before;
	}

	return fileInfos;
}
function collectUnfollowedHistory(commits: GitLogCommit[]): Map<string, RawGitTrackingInfo> {
	const paths = new Map<string, TrackedPath>();
	const fileInfos = new Map<string, RawGitTrackingInfo>();

	for (const commit of commits) {
		for (const entry of commit.entries) {
			const repoPath = entry.kind === 'rename' ? entry.to : entry.path;
			let trackedPath = paths.get(repoPath);
			if (trackedPath === undefined) {
				trackedPath = {
					file: relative(projectRoot, resolve(getRepoRoot(), repoPath)),
					info: undefined,
				};
				paths.set(repoPath, trackedPath);
			}
			addCommit(trackedPath, commit, repoPath, fileInfos);
		}
	}

	return fileInfos;
}

/**
 * @internal
 */
export async function collectGitInfoForContentFiles(): Promise<[string, RawGitTrackingInfo][]> {
	const repoRoot = getRepoRoot();

	const args = [
		'log',
		'--format=%x00t:%H %ct %an <%ae>|%(trailers:key=co-authored-by,valueonly,separator=|)%x00',
		'--name-status',
		'-z',
	];
	if (collectCommitHistory) {
		args.push('-l0', '--find-renames');
	} else {
		args.push('--', projectRoot);
	}

	debug('Retrieving content git log:', args.join(' '));
	const gitLog = spawnSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf-8',
		maxBuffer: maxGitContentBuffer,
	});

	if (gitLog.error || gitLog.status !== 0) {
		debug('Failed to retrieve content git log:', gitLog.error, gitLog.stderr);
		return [];
	}

	const commits = parseGitLog(gitLog.stdout);
	const fileInfos = collectCommitHistory
		? collectHistory(commits, getCurrentRepoPaths(repoRoot))
		: collectUnfollowedHistory(commits);

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
			commits: rawFileInfo.commits.map(createCommitInfo),
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
