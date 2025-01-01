import { spawnSync } from 'node:child_process';
import { sep, resolve, relative } from 'node:path';
import { hooks } from '@inox-tools/modular-station/hooks';
import { getDebug } from '../internal/debug.js';
import type { GitCommitInfo, GitTrackingInfo } from '@it-astro:content/git';

let contentPath: string = '';

const debug = getDebug('git');

/**
 * @internal
 */
export function setContentPath(path: string) {
	contentPath = path;
}

function getRepoRoot(): string {
	debug('Retrieving git repo root');
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
		cwd: contentPath,
		encoding: 'utf-8',
	});

	if (result.error) {
		debug(`Failed to retrieve repo root:`, result.error, result.stderr);
		debug('Falling back to contentPath:', contentPath);
		return contentPath;
	}

	return result.stdout.trim();
}

type GitAuthor = {
	name: string;
	email: string;
};

type RawGitTrackingInfo = {
	earliest: number;
	latest: number;
	authors: GitAuthor[];
	coAuthors: GitAuthor[];
};

/**
 * @internal
 */
export async function collectGitInfoForContentFiles(): Promise<[string, RawGitTrackingInfo][]> {
	const repoRoot = getRepoRoot();

	const args = [
		'log',
		'--format=cmt:%H(%h) %ct %an <%ae>|%(trailers:key=co-authored-by,valueonly,separator=|)',
		'--name-status',
		'--',
		contentPath,
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

	let skipping = false;
	const parsingState: GitCommitInfo = {
		hash: '',
		shortHash: '',
		secondsSinceEpoch: 0,
		author: { name: '', email: '' },
		coAuthors: [],
	};

	const fileInfos = new Map<string, RawGitTrackingInfo>();

	for (const logLine of gitLog.stdout.split('\n')) {
		if (logLine.startsWith('cmt:')) {
			// New commit, stop skipping
			skipping = false;

			const headerLineMatch = logLine.match(
				/^cmt:(?<hash>[a-f0-9]+)\((?<shortHash>[a-f0-9]+)\) (?<epoch>\d+) (?<authorName>[^<]+) <(?<authorEmail>[^>]+)>\|(?<coAuthors>.*?)$/
			);
			if (!headerLineMatch) {
				// Skip data from unparseable commit
				skipping = true;
				continue;
			}

			const groups = headerLineMatch.groups!;

			parsingState.hash = groups.hash;
			parsingState.shortHash = groups.shortHash;
			parsingState.secondsSinceEpoch = Number.parseInt(groups.epoch);
			parsingState.author.name = groups.authorName;
			parsingState.author.email = groups.authorEmail;
			parsingState.coAuthors = groups.coAuthors.split('|').map((author) => {
				const [name, email] = author.split('<');
				return {
					name: name.trim(),
					email: email.slice(0, -1),
				};
			});

			debug('Invoking @it/content:git:commit hook', {
				trackedFiles: Array.from(fileInfos.keys()),
			});
			await hooks.run('@it/content:git:commit', (logger) => [
				{
					logger,
					commitInfo: parsingState,
					drop: () => {
						skipping = true;
					},
				},
			]);

			continue;
		}

		// Skip all entries for a skipped commit
		if (skipping) continue;

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
		const fileName = logLine.slice(tabSplit + 1);

		const fileInfo = fileInfos.get(fileName);

		if (fileInfo === undefined) {
			fileInfos.set(fileName, {
				earliest: parsingState.secondsSinceEpoch,
				latest: parsingState.secondsSinceEpoch,
				authors: [parsingState.author],
				coAuthors: [...parsingState.coAuthors],
			});
			continue;
		}

		fileInfo.earliest = Math.min(fileInfo.earliest, parsingState.secondsSinceEpoch);
		fileInfo.latest = Math.max(fileInfo.latest, parsingState.secondsSinceEpoch);
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
		// git log returns file names relative to the repo root
		// convert the tracked paths to match that format
		const contentFilePath = relative(contentPath, resolve(repoRoot, file));

		// Replace the first occurrence of the separator so it doesn't get partially normalized when mixin Windows and Unix-like systems.
		const name = contentFilePath.replace(sep, ':');

		const fileInfo: GitTrackingInfo = {
			earliest: new Date(rawFileInfo.earliest * 1000),
			latest: new Date(rawFileInfo.latest * 1000),
			authors: rawFileInfo.authors,
			coAuthors: rawFileInfo.coAuthors,
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

		result.push([name, rawFileInfo]);
	}

	return result;
}
