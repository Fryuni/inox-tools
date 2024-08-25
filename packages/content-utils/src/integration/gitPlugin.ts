import type { Plugin } from 'vite';
import type { IntegrationState } from './state.js';
import * as liveGit from '../runtime/git.js';
import { getDebug } from '../internal/debug.js';

const MODULE_ID = '@it-astro:content/git';
const RESOLVED_MODULE_ID = '\x00@it-astro:content/git';

const debug = getDebug('git-time-plugin');

export const gitDevPlugin = ({ contentPaths: { contentPath } }: IntegrationState): Plugin => ({
	name: '@inox-tools/content-utils/gitTimes',
	resolveId(id) {
		if (id === MODULE_ID) return RESOLVED_MODULE_ID;
	},
	load(id, { ssr } = {}) {
		if (id !== RESOLVED_MODULE_ID || !ssr) return;

		debug(`Generated dev mode git time plugin for ${contentPath}`);
		return `
import {setContentPath} from '@inox-tools/content-utils/runtime/git';
export {
	getLatestCommitDate,
	getOldestCommitDate,
	getEntryGitInfo,
} from '@inox-tools/content-utils/runtime/liveGit';

setContentPath(${JSON.stringify(contentPath)});
`;
	},
});

export const gitBuildPlugin = ({ contentPaths: { contentPath } }: IntegrationState): Plugin => ({
	name: '@inox-tools/content-utils/gitTimes',
	resolveId(id) {
		if (id === MODULE_ID) return RESOLVED_MODULE_ID;
	},
	async load(id, { ssr } = {}) {
		if (id !== RESOLVED_MODULE_ID || !ssr) return;

		debug('Registering content path:', contentPath);
		liveGit.setContentPath(contentPath);
		const trackedFiles = await liveGit.collectGitInfoForContentFiles();
		debug('Git tracked file dates:', trackedFiles);

		return `
import {getEntry} from 'astro:content';

const trackedFiles = new Map(${JSON.stringify(trackedFiles)});

export async function getEntryGitInfo(...args) {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

	const file = \`\${entry.collection}:\${entry.id}\`;
	const rawInfo = trackedFiles.get(file);
	if (!rawInfo) return;
	return {
		earliest: new Date(rawInfo.earliest),
		latest: new Date(rawInfo.latest),
		authors: Array.from(rawInfo.authors),
		coAuthors: Array.from(rawInfo.coAuthors),
	};
}

const latestCommits = new Map([
${trackedFiles
				.map(([file, fileInfo]) => `[${JSON.stringify(file)}, new Date(${fileInfo.latest.valueOf()})]`)
				.join(',')}
]);

export async function getLatestCommitDate(...args) {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

	const file = \`\${entry.collection}:\${entry.id}\`;
  const cached = latestCommits.get(file);
  if (cached !== undefined) return cached;
  const now = new Date();
  latestCommits.set(file, now);
  return now;
}

const oldestCommits = new Map([
${trackedFiles
				.map(([file, fileInfo]) => `[${JSON.stringify(file)}, new Date(${fileInfo.earliest.valueOf()})]`)
				.join(',')}
]);

export async function getOldestCommitDate(...args) {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

	const file = \`\${entry.collection}:\${entry.id}\`;
  const cached = oldestCommits.get(file);
  if (cached !== undefined) return cached;
  const now = new Date();
  oldestCommits.set(file, now);
  return now;
}
`;
	},
});
