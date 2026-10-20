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
type CommitContentLoader = (hash: string, repoPath: string) => string;

/**
 * @internal
 */
export function setProjectRoot(path: string) {
	if (projectRoot === path) return;
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
	content?: string;
};

/**
 * @internal
 */
export function createCommitInfo(
	commit: RawCommitInfo,
	loadContent: CommitContentLoader = getFileContentAtCommit
): CommitInfo {
	const commitInfo: Record<string, unknown> = {
		hash: commit.hash,
		date: new Date(commit.date),
		author: commit.author,
		coAuthors: Array.from(commit.coAuthors),
	};
	const lazyContent = Lazy.wrap(() => commit.content ?? loadContent(commit.hash, commit.repoPath));
	Object.defineProperty(commitInfo, 'content', {
		get: () => commit.content ?? lazyContent(),
		set: (content: string) => {
			commit.content = content;
		},
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
	parents: string[];
	date: number;
	author: GitAuthor;
	coAuthors: GitAuthor[];
	parentEntries: GitLogEntry[][];
};

type TrackedPath = {
	file: string;
	info: RawGitTrackingInfo | undefined;
};

type TrackedPaths = ReadonlySet<TrackedPath>;

type PathState = {
	size: number;
	paths?: ReadonlyMap<string, TrackedPaths>;
	parent?: PathState;
	changes?: ReadonlyMap<string, TrackedPaths | undefined>;
	materialized?: ReadonlyMap<string, TrackedPaths>;
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

function parseCommitHeader(
	hashHeader: string,
	parentsHeader: string,
	dateHeader: string,
	authorNameHeader: string,
	authorEmailHeader: string,
	coAuthorHeaders: string[]
): Omit<GitLogCommit, 'parentEntries'> | undefined {
	if (
		!hashHeader.startsWith('t:') ||
		!parentsHeader.startsWith('p:') ||
		!dateHeader.startsWith('d:') ||
		!authorNameHeader.startsWith('a:') ||
		!authorEmailHeader.startsWith('e:')
	) {
		return undefined;
	}

	const date = Number.parseInt(dateHeader.slice(2)) * 1000;
	if (!Number.isFinite(date)) return undefined;

	const coAuthors: GitAuthor[] = [];
	for (const header of coAuthorHeaders) {
		const identity = header.slice(2).trim();
		if (identity === '') continue;

		const emailStart = identity.lastIndexOf('<');
		if (emailStart === -1 || !identity.endsWith('>')) {
			debug('Ignoring malformed co-author trailer:', identity);
			continue;
		}
		coAuthors.push({
			name: identity.slice(0, emailStart).trim(),
			email: identity.slice(emailStart + 1, -1),
		});
	}

	return {
		hash: hashHeader.slice(2),
		parents: parentsHeader
			.slice(2)
			.split(' ')
			.filter((parent) => parent !== ''),
		date,
		author: {
			name: authorNameHeader.slice(2),
			email: authorEmailHeader.slice(2),
		},
		coAuthors,
	};
}

function parseGitLog(output: string | Buffer): GitLogCommit[] {
	const fields = splitNulFields(output);
	const commits: GitLogCommit[] = [];
	let index = 0;

	while (index < fields.length) {
		while (fields[index] === '') index += 1;
		if (index >= fields.length) break;

		const coAuthorHeaders: string[] = [];
		let headerEnd = index + 5;
		while (fields[headerEnd]?.startsWith('c:')) {
			coAuthorHeaders.push(fields[headerEnd++]);
		}
		const header = parseCommitHeader(
			fields[index],
			fields[index + 1],
			fields[index + 2],
			fields[index + 3],
			fields[index + 4],
			coAuthorHeaders
		);
		if (header === undefined) {
			debug('Ignoring malformed git history entry:', fields[index]);
			break;
		}
		index = headerEnd;

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

		const previous = commits.at(-1);
		if (previous !== undefined && previous.hash === header.hash) {
			if (previous.parents.join(' ') !== header.parents.join(' ')) {
				debug('Ignoring git history entry with inconsistent parents:', header.hash);
				break;
			}
			previous.parentEntries.push(entries);
		} else {
			commits.push({ ...header, parentEntries: [entries] });
		}
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

function createPathState(currentPaths: Map<string, TrackedPath>): PathState {
	const paths = new Map<string, TrackedPaths>();
	for (const [path, trackedPath] of currentPaths) {
		paths.set(path, new Set([trackedPath]));
	}
	return { size: paths.size, paths };
}

function getTrackedPaths(state: PathState, path: string): TrackedPaths | undefined {
	for (
		let current: PathState | undefined = state;
		current !== undefined;
		current = current.parent
	) {
		if (current.changes?.has(path)) return current.changes.get(path);
		if (current.paths !== undefined) return current.paths.get(path);
	}
	return undefined;
}

function unionTrackedPaths(first: TrackedPaths, second: TrackedPaths): TrackedPaths {
	if (first === second) return first;
	const paths = new Set(first);
	for (const path of second) paths.add(path);
	return paths;
}

function rewindPaths(paths: PathState, entries: GitLogEntry[]): PathState {
	let size = paths.size;
	let changes: Map<string, TrackedPaths | undefined> | undefined;
	const get = (path: string) => {
		if (changes?.has(path)) return changes.get(path);
		return getTrackedPaths(paths, path);
	};
	const set = (path: string, trackedPaths: TrackedPaths | undefined) => {
		const previous = get(path);
		if (previous === trackedPaths) return;
		if (previous === undefined && trackedPaths !== undefined) size += 1;
		if (previous !== undefined && trackedPaths === undefined) size -= 1;
		changes ??= new Map();
		changes.set(path, trackedPaths);
	};

	for (const entry of entries) {
		if (entry.kind === 'add' || entry.kind === 'copy') {
			if (get(entry.path) !== undefined) set(entry.path, undefined);
			continue;
		}
		if (entry.kind !== 'rename') continue;

		const trackedPaths = get(entry.to);
		if (trackedPaths === undefined) continue;
		set(entry.to, undefined);
		const previous = get(entry.from);
		set(
			entry.from,
			previous === undefined ? trackedPaths : unionTrackedPaths(previous, trackedPaths)
		);
	}

	return changes === undefined ? paths : { size, parent: paths, changes };
}

function materializePaths(state: PathState): ReadonlyMap<string, TrackedPaths> {
	if (state.paths !== undefined) return state.paths;
	if (state.materialized !== undefined) return state.materialized;

	const paths = new Map(materializePaths(state.parent!));
	for (const [path, trackedPaths] of state.changes!) {
		if (trackedPaths === undefined) paths.delete(path);
		else paths.set(path, trackedPaths);
	}
	state.materialized = paths;
	return paths;
}

function mergePathStates(states: PathState[]): PathState | undefined {
	const uniqueStates = Array.from(new Set(states.filter((state) => state.size > 0)));
	if (uniqueStates.length === 0) return undefined;
	if (uniqueStates.length === 1) return uniqueStates[0];

	const paths = new Map<string, TrackedPaths>();
	for (const state of uniqueStates) {
		for (const [path, trackedPaths] of materializePaths(state)) {
			const previous = paths.get(path);
			paths.set(
				path,
				previous === undefined ? trackedPaths : unionTrackedPaths(previous, trackedPaths)
			);
		}
	}
	return { size: paths.size, paths };
}

function associateMergeParentEntries(commits: GitLogCommit[], repoRoot: string) {
	for (const commit of commits) {
		if (commit.parents.length < 2) continue;

		const parentEntries: GitLogEntry[][] = [];
		let variant = 0;
		for (const parent of commit.parents) {
			const result = spawnSync('git', ['diff', '--quiet', '--no-ext-diff', parent, commit.hash], {
				cwd: repoRoot,
			});
			if (result.error || (result.status !== 0 && result.status !== 1)) {
				debug('Failed to associate git merge diff with parent:', commit.hash, parent, result.error);
				parentEntries.length = 0;
				break;
			}
			if (result.status === 0) {
				parentEntries.push([]);
				continue;
			}

			const entries = commit.parentEntries[variant++];
			if (entries === undefined) {
				debug('Missing git merge diff for parent:', commit.hash, parent);
				parentEntries.length = 0;
				break;
			}
			parentEntries.push(entries);
		}

		if (parentEntries.length !== commit.parents.length) continue;
		const hasEmptyPlaceholder =
			variant === 0 && commit.parentEntries.length === 1 && commit.parentEntries[0].length === 0;
		if (variant !== commit.parentEntries.length && !hasEmptyPlaceholder) {
			debug('Unexpected git merge diff count:', commit.hash);
			continue;
		}
		commit.parentEntries = parentEntries;
	}
}

function collectHistory(
	commits: GitLogCommit[],
	currentPaths: Map<string, TrackedPath>
): Map<string, RawGitTrackingInfo> {
	const pathsByCommit = new Map<string, PathState[]>();
	const initialPaths = createPathState(currentPaths);
	if (commits[0] !== undefined && initialPaths.size > 0) {
		pathsByCommit.set(commits[0].hash, [initialPaths]);
	}

	const fileInfos = new Map<string, RawGitTrackingInfo>();
	for (const commit of commits) {
		const paths = mergePathStates(pathsByCommit.get(commit.hash) ?? []);
		if (paths === undefined) continue;

		const recorded = new Set<TrackedPath>();
		for (const entries of commit.parentEntries) {
			for (const entry of entries) {
				const repoPath = entry.kind === 'rename' ? entry.to : entry.path;
				for (const trackedPath of getTrackedPaths(paths, repoPath) ?? []) {
					if (recorded.has(trackedPath)) continue;
					addCommit(trackedPath, commit, repoPath, fileInfos);
					recorded.add(trackedPath);
				}
			}
		}

		for (const [index, parent] of commit.parents.entries()) {
			const entries = commit.parentEntries[index];
			if (entries === undefined) {
				debug('Missing git merge diff for parent:', commit.hash, parent);
				continue;
			}
			const parentPaths = rewindPaths(paths, entries);
			if (parentPaths.size === 0) continue;
			const states = pathsByCommit.get(parent);
			if (states === undefined) pathsByCommit.set(parent, [parentPaths]);
			else states.push(parentPaths);
		}
	}

	return fileInfos;
}
function collectUnfollowedHistory(commits: GitLogCommit[]): Map<string, RawGitTrackingInfo> {
	const paths = new Map<string, TrackedPath>();
	const fileInfos = new Map<string, RawGitTrackingInfo>();

	for (const commit of commits) {
		for (const entries of commit.parentEntries) {
			for (const entry of entries) {
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
	}

	return fileInfos;
}

/**
 * @internal
 */
export async function collectGitInfoForContentFiles(
	loadContent: CommitContentLoader = getFileContentAtCommit
): Promise<[string, RawGitTrackingInfo][]> {
	const repoRoot = getRepoRoot();

	const args = [
		'log',
		'--format=%x00t:%H%x00p:%P%x00d:%ct%x00a:%an%x00e:%ae%x00c:%(trailers:key=co-authored-by,valueonly,separator=%x00c:)%x00',
		'--name-status',
		'-z',
	];
	if (collectCommitHistory) {
		args.push('--topo-order', '--diff-merges=separate', '--root', '-l0', '--find-renames');
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
	if (collectCommitHistory) associateMergeParentEntries(commits, repoRoot);
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
		const rawCommitsByHash = new Map(
			rawFileInfo.commits.map((commit) => [commit.hash, commit] as const)
		);
		const rawCommitByPublicCommit = new WeakMap<CommitInfo, RawCommitInfo>();
		const commits = rawFileInfo.commits.map((commit) => {
			const publicCommit = createCommitInfo(commit, loadContent);
			rawCommitByPublicCommit.set(publicCommit, commit);
			return publicCommit;
		});
		const fileInfo: GitTrackingInfo = {
			earliest: new Date(rawFileInfo.earliest),
			latest: new Date(rawFileInfo.latest),
			authors: rawFileInfo.authors,
			coAuthors: rawFileInfo.coAuthors,
			commits,
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
		rawFileInfo.authors = Array.from(fileInfo.authors);
		rawFileInfo.coAuthors = Array.from(fileInfo.coAuthors);
		rawFileInfo.commits = (fileInfo.commits ?? []).map((commit) => {
			const identityOriginal = rawCommitByPublicCommit.get(commit);
			const original = identityOriginal ?? rawCommitsByHash.get(commit.hash);
			if (original === undefined || (identityOriginal && commit.hash !== identityOriginal.hash)) {
				throw new Error(`Cannot add untracked commit ${commit.hash} in the resolved Git hook`);
			}

			const syncedCommit: RawCommitInfo = {
				hash: commit.hash,
				date: commit.date.valueOf(),
				author: commit.author,
				coAuthors: Array.from(commit.coAuthors),
				repoPath: original.repoPath,
			};
			if (identityOriginal === undefined) {
				syncedCommit.content = commit.content;
			} else if (original.content !== undefined) {
				syncedCommit.content = original.content;
			}
			return syncedCommit;
		});

		result.push([file, rawFileInfo]);
	}

	return result;
}
