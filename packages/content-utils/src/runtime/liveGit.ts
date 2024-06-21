import { getEntry } from 'astro:content';
import { join } from 'node:path';
import { getCommitDate } from './git.js';

const memoizedLatest = new Map<string, Date>();

export async function getLatestCommitDate(...args: Parameters<typeof getEntry>): Promise<Date> {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

	const file = join(entry.collection, entry.id);
	const cached = memoizedLatest.get(file);
	if (cached !== undefined) {
		return cached;
	}

	const date = await getCommitDate(file, 'latest');
	memoizedLatest.set(file, date);
	return date;
}

const memoizedOldest = new Map<string, Date>();

export async function getOldestCommitDate(...args: Parameters<typeof getEntry>): Promise<Date> {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

	const file = join(entry.collection, entry.id);
	const cached = memoizedOldest.get(file);
	if (cached !== undefined) {
		return cached;
	}

	const date = await getCommitDate(file, 'oldest');
	memoizedOldest.set(file, date);
	return date;
}
