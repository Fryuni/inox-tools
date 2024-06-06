import { spawnSync } from 'node:child_process';
import { basename, dirname, join, sep, resolve } from 'node:path';

let contentPath: string = '';

export function setContentPath(path: string) {
	contentPath = path;
}

export function getCommitDate(file: string, age: 'oldest' | 'latest'): Date {
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

	const timestamp = Number(match.groups.timestamp);
	return new Date(timestamp * 1000);
}

export function listGitTrackedFiles(): string[] {
	const result = spawnSync('git', ['ls-files'], {
		cwd: resolve(contentPath),
		encoding: 'utf-8',
	});

	if (result.error) {
		return [];
		// throw new Error(`Failed to retrieve list of git tracked files in "${contentPath}"`);
	}

	const output = result.stdout.trim();
	return output.split('\n');
}

type TrackedCommits = {
	oldest: [string, Date][];
	latest: [string, Date][];
};

export function getAllTrackedCommitDates(): TrackedCommits {
	const trackedFiles = listGitTrackedFiles();

	// Replace the first occurrence of the separator so it doesn't get partially normalized when mixin Windows and Unix-like systems.
	return {
		oldest: trackedFiles.map((file) => [file.replace(sep, ':'), getCommitDate(file, 'oldest')]),
		latest: trackedFiles.map((file) => [file.replace(sep, ':'), getCommitDate(file, 'latest')]),
	};
}
