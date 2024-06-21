import type { HookTrigger } from '@inox-tools/modular-station';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, sep, resolve } from 'node:path';

let contentPath: string = '';

/**
 * @internal
 */
export function setContentPath(path: string) {
	contentPath = path;
}

const commitResolvedHook: HookTrigger<'@it-astro:content:gitCommitResolved'> = (globalThis as any)[
	Symbol.for('@inox-tools/content-utils:triggers/gitCommitResolved')
];

/**
 * @internal
 */
export async function getCommitDate(file: string, age: 'oldest' | 'latest'): Promise<Date> {
	const args = ['log', '--format=%ct', '--max-count=1'];

	if (age === 'oldest') {
		args.push('--follow', '--diff-filter=A');
	}

	args.push(basename(file));

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
		console.error(result.stderr, result.stdout);
		return new Date();
	}

	let resolvedDate = new Date(Number(match.groups.timestamp) * 1000);

	await commitResolvedHook({
		resolvedDate,
		age,
		file,
		overrideDate: (newDate) => {
			resolvedDate = newDate;
		},
	});

	return resolvedDate;
}

const trackedListResolvedHook: HookTrigger<'@it-astro:content:gitTrackedListResolved'> = (
	globalThis as any
)[Symbol.for('@inox-tools/content-utils:triggers/gitTrackedListResolved')];

/**
 * @internal
 */
export async function listGitTrackedFiles(): Promise<string[]> {
	const result = spawnSync('git', ['ls-files'], {
		cwd: resolve(contentPath),
		encoding: 'utf-8',
	});

	if (result.error) {
		return [];
		// throw new Error(`Failed to retrieve list of git tracked files in "${contentPath}"`);
	}

	const output = result.stdout.trim();
	let files = output.split('\n');

	await trackedListResolvedHook({
		trackedFiles: Array.from(files),
		ignoreFiles: (ignore) => {
			for (const file of ignore) {
				const index = files.indexOf(file);
				if (index !== -1) {
					files.splice(index, 1);
				}
			}
		},
	});

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
