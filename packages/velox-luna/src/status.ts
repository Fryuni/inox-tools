import { loadConfig, type LunariaConfig } from '@lunariajs/core/config';
import { git } from '@lunariajs/core/git';
import { lunaria, type LocalizationStatus, type GitHistory } from '@lunariajs/core';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { parseCommand } from './command.js';

type CommitRange = {
	from: string;
	to: string;
};

export async function getCommitRange(target: TargetStatus): Promise<CommitRange> {
	const latestTranslatedCommit = await getCommitHashFromInfo(target);

	const from = latestTranslatedCommit;
	const to = 'HEAD';

	return { from, to };
}

async function getCommitHashFromInfo(target: TargetStatus): Promise<string> {
	if (!!target.git.lastMajorCommitHash) return target.git.lastMajorCommitHash;

	const res = await git.raw([
		'git',
		'log',
		'--follow',
		'--format=%H',
		`--since="${target.git.lastMajorChange}"`,
		'--',
		target.localizedFile,
	]);

	return res.trim().split('\n').at(-1)!.trim();
}

type TargetStatus = {
	sourceFile: string;
	localizedFile: string;
	git: GitHistory;
};

export async function getTargetStatus(
	command: ReturnType<typeof parseCommand>
): Promise<TargetStatus> {
	const { userConfig } = await loadConfig(command.configPath);

	const status = await getStatus(userConfig, command.rebuild);

	const targetFileStatus = status.find((s) => s.sharedPath.endsWith(command.targetFile));

	if (targetFileStatus === undefined) {
		throw new Error(`Could not find status for target file: ${command.targetFile}`);
	}

	const localizedStatus = targetFileStatus.localizations[command.locale];

	if (localizedStatus === undefined || localizedStatus.isMissing) {
		throw new Error(`Could not find localization for locale: ${command.locale}`);
	}

	return {
		sourceFile: targetFileStatus.sourceFile.path,
		localizedFile: localizedStatus.path,
		git: localizedStatus.git,
	};
}

async function getStatus(config: LunariaConfig, rebuild: boolean): Promise<LocalizationStatus[]> {
	const statusPath = join(config.outDir, 'status.json');

	if (!rebuild) {
		const prebuiltContent = await readFile(statusPath, 'utf-8').catch(() => null);

		if (prebuiltContent !== null) {
			return JSON.parse(prebuiltContent);
		}
	}

	const newProcessedStatus = await lunaria(config);

	// Ensure output directory exists
	await mkdir(config.outDir, { recursive: true });
	await writeFile(statusPath, JSON.stringify(newProcessedStatus, null, 2));

	return newProcessedStatus;
}
