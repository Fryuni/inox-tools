import { spawnSync } from 'node:child_process';
import { basename, dirname, join, sep, resolve, relative } from 'node:path';
import { hooks } from '@inox-tools/modular-station/hooks';
import { getDebug } from '../internal/debug.js';

let contentPath: string = '';

const debug = getDebug('git');

/**
 * @internal
 */
export function setContentPath(path: string) {
	contentPath = path;
}

/**
 * @internal
 */
export async function getCommitDate(file: string, age: 'oldest' | 'latest'): Promise<Date> {
	const args = ['log', '--format=%ct', '--max-count=1'];

	if (age === 'oldest') {
		args.push('--follow', '--diff-filter=A');
	}

	args.push('--', basename(file));

	debug('Running git:', args.join(' '));

	const result = spawnSync('git', args, {
		cwd: resolve(join(contentPath, dirname(file))),
		encoding: 'utf-8',
	});

	if (result.error) {
		console.error(result.error, result.stderr);
		return new Date();
	}
	const output = result.stdout.trim();
	const regex = /^(?<timestamp>\d+)$/;
	const match = output.match(regex);

	if (!match?.groups?.timestamp) {
		debug('No match on Git output:', result.stderr, result.stdout);
		return new Date();
	}

	let resolvedDate = new Date(Number(match.groups.timestamp) * 1000);

	debug('Invoking @it/content:git:resolved hook', {
		resolvedDate,
		age,
		file,
	});
	await hooks.run('@it/content:git:resolved', (logger) => [
		{
			logger,
			resolvedDate,
			age,
			file,
			overrideDate: (newDate) => {
				debug(`Overriding ${resolvedDate} date of ${file} to ${newDate}`);
				resolvedDate = newDate;
			},
		},
	]);

	return resolvedDate;
}

/**
 * @internal
 */
export async function listGitTrackedFiles(): Promise<string[]> {
	debug(`Listing tracked files in ${contentPath}`);
	const result = spawnSync('git', ['ls-files'], {
		cwd: resolve(contentPath),
		encoding: 'utf-8',
	});

	if (result.error) {
		return [];
	}

	const output = result.stdout.trim();
	let files = output.split('\n');

	debug('Invoking @it/content:git:listed hook', { trackedFiles: files });
	await hooks.run('@it/content:git:listed', (logger) => [
		{
			logger,
			trackedFiles: Array.from(files),
			ignoreFiles: (ignore) => {
				for (const file of ignore) {
					const index = files.indexOf(file);
					if (index !== -1) {
						files.splice(index, 1);
					}
				}
			},
		},
	]);

	return files;
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

type TrackedCommits = {
	oldest: [string, Date][];
	latest: [string, Date][];
};

/**
 * @internal
 */
export async function getAllTrackedCommitDates(): Promise<TrackedCommits> {
	const repoRoot = getRepoRoot();
	const trackedFiles = await listGitTrackedFiles();

	const args = ['log', '--format=t:%ct', '--name-status', '--', contentPath];

	debug('Retrieving content git log:', args.join(' '));
	const gitLog = spawnSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf-8',
	});

	if (gitLog.error) {
		debug('Failed to retrieve content git log:', gitLog.error, gitLog.stderr);
		return {
			oldest: [],
			latest: [],
		};
	}

	const logLines = gitLog.stdout.trim().split('\n');

	let runningDate: number = Date.now();
	const runningMinMax = new Map<string, { min: number; max: number }>();

	for (const logLine of logLines) {
		if (logLine.startsWith('t:')) {
			// t:<seconds since epoch>
			runningDate = Number.parseInt(logLine.slice(2)) * 1000;
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
		const fileName = logLine.slice(tabSplit + 1);

		const minMax = runningMinMax.get(fileName);

		if (minMax === undefined) {
			runningMinMax.set(fileName, {
				min: runningDate,
				max: runningDate,
			});
			continue;
		}

		minMax.min = Math.min(minMax.min, runningDate);
		minMax.max = Math.max(minMax.max, runningDate);
	}

	const result: TrackedCommits = {
		oldest: [],
		latest: [],
	};

	for (const file of trackedFiles) {
		// git log returns file names relative to the repo root
		// convert the tracked paths to match that format
		const repoFilePath = relative(repoRoot, resolve(contentPath, file));

		const minMax = runningMinMax.get(repoFilePath);
		if (minMax === undefined) {
			debug(`No date found for ${repoFilePath}`);
			continue;
		}

		// Replace the first occurrence of the separator so it doesn't get partially normalized when mixin Windows and Unix-like systems.
		const name = file.replace(sep, ':');

		result.oldest.push([name, new Date(minMax.min)]);
		result.latest.push([name, new Date(minMax.max)]);
	}

	return result;
}
