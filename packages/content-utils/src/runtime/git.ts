import { spawnSync } from 'node:child_process';
import { basename, dirname, join, sep, resolve } from 'node:path';
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

	args.push(basename(file));

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

type TrackedCommits = {
	oldest: [string, Date][];
	latest: [string, Date][];
};

/**
 * @internal
 */
export async function getAllTrackedCommitDates(): Promise<TrackedCommits> {
	const trackedFiles = await listGitTrackedFiles();

	const result: TrackedCommits = {
		oldest: [],
		latest: [],
	};

	for (const file of trackedFiles) {
		// Replace the first occurrence of the separator so it doesn't get partially normalized when mixin Windows and Unix-like systems.
		const name = file.replace(sep, ':');

		result.oldest.push([name, await getCommitDate(file, 'oldest')]);
		result.latest.push([name, await getCommitDate(file, 'latest')]);
	}

	return result;
}
