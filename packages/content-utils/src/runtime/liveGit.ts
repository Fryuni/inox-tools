import { getEntry } from 'astro:content';
import { join } from 'node:path';
import { collectGitInfoForContentFiles } from './git.js';
import type { GitTrackingInfo } from '@it-astro:content/git';

const trackedInfo = new Map(await collectGitInfoForContentFiles());

export async function getEntryGitInfoInner(
	args: Parameters<typeof getEntry>
): Promise<[string, GitTrackingInfo?]> {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

	const file = `${entry.collection}:${entry.id}`;

	const info = trackedInfo.get(file);
	if (!info) return [file];

	return [
		file,
		{
			earliest: new Date(info.earliest),
			latest: new Date(info.latest),
			authors: Array.from(info.authors),
			coAuthors: Array.from(info.coAuthors),
		},
	];
}

export async function getEntryGitInfo(
	...args: Parameters<typeof getEntry>
): Promise<GitTrackingInfo | undefined> {
	const [, info] = await getEntryGitInfoInner(args);
	return info;
}

const memoizedLatest = new Map<string, Date>();

export async function getLatestCommitDate(...args: Parameters<typeof getEntry>): Promise<Date> {
	const [file, info] = await getEntryGitInfoInner(args);

	if (info !== undefined) return info.latest;

	const cached = memoizedLatest.get(file);
	if (cached !== undefined) {
		return cached;
	}

	const date = new Date();
	memoizedLatest.set(file, date);
	return date;
}

const memoizedOldest = new Map<string, Date>();

export async function getOldestCommitDate(...args: Parameters<typeof getEntry>): Promise<Date> {
	const [file, info] = await getEntryGitInfoInner(args);

	if (info !== undefined) return info.latest;

	const cached = memoizedOldest.get(file);
	if (cached !== undefined) {
		return cached;
	}

	const date = new Date();
	memoizedOldest.set(file, date);
	return date;
}
