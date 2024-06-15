import type { Plugin } from 'vite';
import type { IntegrationState } from './state.js';
import * as liveGit from '../runtime/git.js';

const MODULE_ID = '@it-astro:content/git';
const RESOLVED_MODULE_ID = '\x00@it-astro:content/git';

export const gitTimeDevPlugin = ({ contentPaths: { contentPath } }: IntegrationState): Plugin => ({
	name: '@inox-tools/content-utils/gitTimes',
	resolveId(id) {
		if (id === MODULE_ID) return RESOLVED_MODULE_ID;
	},
	load(id, { ssr } = {}) {
		if (id !== RESOLVED_MODULE_ID || !ssr) return;

		return `
import {setContentPath} from '@inox-tools/content-utils/runtime/git';
import {getLatestCommitDate, getOldestCommitDate} from '@inox-tools/content-utils/runtime/liveGit';

setContentPath(${JSON.stringify(contentPath)});

export {getLatestCommitDate, getOldestCommitDate};
`;
	},
});

export const gitTimeBuildPlugin = ({
	contentPaths: { contentPath },
}: IntegrationState): Plugin => ({
	name: '@inox-tools/content-utils/gitTimes',
	resolveId(id) {
		if (id === MODULE_ID) return RESOLVED_MODULE_ID;
	},
	load(id, { ssr } = {}) {
		if (id !== RESOLVED_MODULE_ID || !ssr) return;

		liveGit.setContentPath(contentPath);
		const trackedFiles = liveGit.getAllTrackedCommitDates();

		return `
import {getEntry} from 'astro:content';

const latestCommits = new Map([
${trackedFiles.latest.map(([file, date]) => `[${JSON.stringify(file)}, new Date(${date.valueOf()})]`).join(',')}
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
${trackedFiles.oldest.map(([file, date]) => `[${JSON.stringify(file)}, new Date(${date.valueOf()})]`).join(',')}
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
