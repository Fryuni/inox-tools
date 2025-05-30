import type { Plugin } from 'vite';
import type { IntegrationState } from './state.js';
import * as liveGit from '../runtime/git.js';
import * as devalue from 'devalue';
import { dirname, join as joinPath, resolve } from 'node:path';
import { getDebug } from '../internal/debug.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODULE_ID = '@it-astro:content/git';
const RESOLVED_MODULE_ID = '\x00@it-astro:content/git';

const INNER_MODULE_ID = '@it-astro:content/git/internal';
const RESOLVED_INNER_MODULE_ID = '\x00@it-astro:content/git/internal';

const debug = getDebug('git-time-plugin');

const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);

debug('Resolution base:', { thisFile, thisDir });

export const gitDevPlugin = ({ contentPaths: { projectRoot } }: IntegrationState): Plugin => ({
	name: '@inox-tools/content-utils/gitTimes',
	resolveId(id) {
		if (id === MODULE_ID) return RESOLVED_MODULE_ID;
	},
	load(id, { ssr } = {}) {
		if (id !== RESOLVED_MODULE_ID || !ssr) return;

		debug(`Generated dev mode git time plugin for ${projectRoot}`);
		return `
import {setProjectRoot} from ${JSON.stringify(resolve(thisDir, 'runtime/git.js'))};
export {
	getLatestCommitDate,
	getOldestCommitDate,
	getEntryGitInfo,
} from ${JSON.stringify(resolve(thisDir, 'runtime/liveGit.js'))};

setProjectRoot(${JSON.stringify(projectRoot)});
`;
	},
});

export const gitBuildPlugin = (state: IntegrationState): Plugin => {
	const {
		contentPaths: { projectRoot },
	} = state;

	return {
		name: '@inox-tools/content-utils/gitTimes',
		resolveId(id) {
			if (id === MODULE_ID) return RESOLVED_MODULE_ID;
			if (id === INNER_MODULE_ID) return RESOLVED_INNER_MODULE_ID;
		},
		writeBundle(info, bundle) {
			if (!info.dir) return;
			let contentDataEntrypoint: string | undefined;
			let gitStateEntrypoint: string | undefined;
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') continue;
				if (chunk.moduleIds.length !== 1) continue;

				switch (chunk.moduleIds[0]) {
					case RESOLVED_INNER_MODULE_ID:
						gitStateEntrypoint = joinPath(info.dir, chunk.fileName);
						break;
					case '\0astro:data-layer-content':
						contentDataEntrypoint = joinPath(info.dir, chunk.fileName);
						break;
				}
			}

			if (contentDataEntrypoint && gitStateEntrypoint) {
				state.cleanups.push(() => cleanupState(contentDataEntrypoint, gitStateEntrypoint));
			}
		},
		async load(id, { ssr } = {}) {
			if (!ssr) return;

			if (id === RESOLVED_MODULE_ID) return buildFacade;

			if (id === RESOLVED_INNER_MODULE_ID) {
				debug('Registering project root:', projectRoot);
				liveGit.setProjectRoot(projectRoot);
				const trackedFiles = await liveGit.collectGitInfoForContentFiles();
				debug('Git tracked file dates:', trackedFiles);

				return `const trackedFiles = ${devalue.stringify(new Map(trackedFiles))};
export { trackedFiles as default };`;
			}
		},
	};
};

async function cleanupState(contentData: string, gitState: string): Promise<void> {
	if (!existsSync(contentData) || !existsSync(gitState)) return;

	const originalContent = readFileSync(gitState, 'utf-8');

	// Content was already cleared by Astro. Collections are not used anywhere on server bundle
	if (!originalContent.includes('export')) return;

	// Import the chunk, which exports a devalue flattened map as the default export
	const { default: contentValue } = await import(/*@vite-ignore*/ contentData);
	const { default: gitValue } = await import(/*@vite-ignore*/ gitState);

	// Unflatten the map
	const contentMap: Map<string, Map<string, unknown>> = devalue.unflatten(contentValue);
	const gitInformation: Map<string, unknown> = devalue.unflatten(gitValue);

	const usedFiles = new Set();

	// Extract all files that are used by the content layer
	for (const collection of contentMap.values()) {
		for (const entry of collection.values()) {
			if (typeof entry === 'object' && entry && 'filePath' in entry && entry.filePath) {
				usedFiles.add(entry.filePath);
			}
		}
	}

	// Build a reduced map including only the used files
	const cleanedMap = new Map(
		Array.from(gitInformation.entries()).filter(([path]) => usedFiles.has(path))
	);

	// Build the source code with the new map flattened
	const newContent = [
		`const trackedFiles = ${devalue.stringify(cleanedMap)}`,
		'\nexport { trackedFiles as default }',
	].join('\n');

	// Write it back
	writeFileSync(gitState, newContent, 'utf-8');
}

const buildFacade = `
import {getEntry} from 'astro:content';
import {unflatten} from ${JSON.stringify(import.meta.resolve('devalue'))};

const trackedFiles = unflatten((await import(${JSON.stringify(INNER_MODULE_ID)})).default);

export async function getEntryGitInfo(...args) {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

	const rawInfo = trackedFiles.get(entry.filePath);
	if (!rawInfo) return;
	return {
		earliest: new Date(rawInfo.earliest),
		latest: new Date(rawInfo.latest),
		authors: Array.from(rawInfo.authors),
		coAuthors: Array.from(rawInfo.coAuthors),
	};
}

const latestCommits = new Map(
	Array.from(trackedFiles.entries())
		.map(([file, fileInfo]) => [file, new Date(fileInfo.latest)])
);

export async function getLatestCommitDate(...args) {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

  const cached = latestCommits.get(entry.filePath);
  if (cached !== undefined) return cached;
  const now = new Date();
  latestCommits.set(entry.filePath, now);
  return now;
}

const oldestCommits = new Map(
	Array.from(trackedFiles.entries())
		.map(([file, fileInfo]) => [file, new Date(fileInfo.earliest)])
);

export async function getOldestCommitDate(...args) {
	const params = args.length > 1 ? args : [args[0].collection, args[0].slug ?? args[0].id];
	const entry = await getEntry(...params);

  const cached = oldestCommits.get(entry.filePath);
  if (cached !== undefined) return cached;
  const now = new Date();
  oldestCommits.set(entry.filePath, now);
  return now;
}
`;
