import { git } from '@lunariajs/core/git';
import { spawn } from 'node:child_process';

export async function getAllFileRenames(
	currentPath: string,
	sinceCommit: string
): Promise<string[]> {
	const res = await git.raw([
		'log',
		'--name-status',
		'--diff-filter=R',
		'--pretty=format:',
		`${sinceCommit}...HEAD`,
	]);

	const fileRenames = res
		.trim()
		.split('\n')
		.filter((line) => line.charAt(0) === 'R')
		.map((line) => line.split('\t'))
		.map(([, from, to]) => ({ from, to }));

	let latestName = currentPath;
	const previousNames: string[] = [];

	for (const { from, to } of fileRenames) {
		if (latestName === to) {
			previousNames.push(from);
			latestName = from;
		}
	}

	return previousNames;
}

export async function showDiffForFile(filePath: string, sinceCommit: string): Promise<void> {
	const oldNames = await getAllFileRenames(filePath, sinceCommit);

	await new Promise<void>((resolve, reject) => {
		const cmd = spawn(
			'git',
			['diff', '--find-renames', `${sinceCommit}...HEAD`, '--', filePath, ...oldNames],
			{
				stdio: 'inherit',
			}
		);

		cmd.once('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`git diff exited with code ${code}`));
			}
		});
	});
}
