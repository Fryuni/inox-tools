import type { Plugin } from 'vite';
import type { IntegrationState } from './state.js';
import * as liveGit from '../runtime/git.js';
import * as devalue from 'devalue';
import { dirname, join as joinPath, resolve } from 'node:path';
import { getDebug } from '../internal/debug.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

const MODULE_ID = '@it-astro:content/git';
const RESOLVED_MODULE_ID = '\x00@it-astro:content/git';

const DEV_CONFIG_MODULE_ID = '@it-astro:content/git/dev-config';
const RESOLVED_DEV_CONFIG_MODULE_ID = '\x00@it-astro:content/git/dev-config';

const INNER_MODULE_ID = '@it-astro:content/git/internal';
const RESOLVED_INNER_MODULE_ID = '\x00@it-astro:content/git/internal';
const GIT_STATE_START = '__INOX_CONTENT_GIT_STATE_START__';
const GIT_STATE_END = '__INOX_CONTENT_GIT_STATE_END__';

const debug = getDebug('git-time-plugin');

const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);

debug('Resolution base:', { thisFile, thisDir });

export const gitDevPlugin = (state: IntegrationState): Plugin => {
	const {
		contentPaths: { projectRoot },
	} = state;
	return {
		name: '@inox-tools/content-utils/gitTimes',
		resolveId(id) {
			if (id === MODULE_ID) return RESOLVED_MODULE_ID;
			if (id === DEV_CONFIG_MODULE_ID) return RESOLVED_DEV_CONFIG_MODULE_ID;
		},
		load(id, { ssr } = {}) {
			if (!ssr) return;

			if (id === RESOLVED_DEV_CONFIG_MODULE_ID) {
				return `
import {setProjectRoot, setCollectCommitHistory} from ${JSON.stringify(resolve(thisDir, 'runtime/git.js'))};

setProjectRoot(${JSON.stringify(projectRoot)});
setCollectCommitHistory(${JSON.stringify(state.collectCommitHistory)});
`;
			}

			if (id !== RESOLVED_MODULE_ID) return;

			debug(`Generated dev mode git time plugin for ${projectRoot}`);
			return `
import ${JSON.stringify(DEV_CONFIG_MODULE_ID)};
export {
	getLatestCommitDate,
	getOldestCommitDate,
	getEntryGitInfo,
} from ${JSON.stringify(resolve(thisDir, 'runtime/liveGit.js'))};
`;
		},
	};
};

export const gitBuildPlugin = (state: IntegrationState): Plugin => {
	const {
		contentPaths: { projectRoot },
	} = state;
	const buildContentLoaderKey = `@inox-tools/content-utils:build-content:${projectRoot}`;
	const buildContentLoaderSymbol = Symbol.for(buildContentLoaderKey);
	const loadCommitContent = (hash: string, repoPath: string) => {
		liveGit.setProjectRoot(projectRoot);
		return liveGit.getFileContentAtCommit(hash, repoPath);
	};
	const gitStateStart = GIT_STATE_START;
	const gitStateEnd = GIT_STATE_END;
	let initialSerializedGitState: string | undefined;
	let collectedGitInformation: Map<string, BuildGitTrackingInfo> | undefined;
	let retainedContentFiles: Set<string> | undefined;
	let buildContentLoaderRegistered = false;

	return {
		name: '@inox-tools/content-utils/gitTimes',
		resolveId(id) {
			if (id === MODULE_ID) return RESOLVED_MODULE_ID;
			if (id === INNER_MODULE_ID) return RESOLVED_INNER_MODULE_ID;
		},
		transform(code, id) {
			if (id !== '\0astro:data-layer-content') return;
			const ast = this.parse(code);
			const defaultExport = ast.body.find((node) => node.type === 'ExportDefaultDeclaration');
			if (
				defaultExport?.type !== 'ExportDefaultDeclaration' ||
				typeof defaultExport.declaration.start !== 'number' ||
				typeof defaultExport.declaration.end !== 'number'
			) {
				return;
			}

			const serializedContent = code.slice(
				defaultExport.declaration.start,
				defaultExport.declaration.end
			);
			try {
				const contentMap: Map<string, Map<string, unknown>> = devalue.unflatten(
					JSON.parse(serializedContent)
				);
				for (const collection of state.staticOnlyCollections) {
					contentMap.delete(collection);
				}
				retainedContentFiles = new Set();
				for (const collection of contentMap.values()) {
					for (const entry of collection.values()) {
						if (typeof entry === 'object' && entry && 'filePath' in entry && entry.filePath) {
							retainedContentFiles.add(entry.filePath as string);
						}
					}
				}
			} catch (error) {
				debug('Failed to capture content entry paths for combined output:', error);
			}
		},
		writeBundle(info, bundle) {
			if (!info.dir) return;
			let contentDataEntrypoint: string | undefined;
			let gitStateEntrypoint: string | undefined;
			let gitStateIsDedicated = false;
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') continue;
				const containsGitState = chunk.moduleIds.includes(RESOLVED_INNER_MODULE_ID);
				const containsContentData = chunk.moduleIds.includes('\0astro:data-layer-content');
				if (!containsGitState && !containsContentData) continue;
				if (containsGitState) {
					gitStateEntrypoint = joinPath(info.dir, chunk.fileName);
					gitStateIsDedicated = chunk.moduleIds.length === 1;
				}
				if (containsContentData && chunk.moduleIds.length === 1) {
					contentDataEntrypoint = joinPath(info.dir, chunk.fileName);
				}
			}

			if (gitStateEntrypoint && collectedGitInformation) {
				state.cleanups.push(async () => {
					try {
						if (gitStateIsDedicated && contentDataEntrypoint) {
							await cleanupState(contentDataEntrypoint, gitStateEntrypoint, loadCommitContent);
						} else {
							if (retainedContentFiles === undefined || initialSerializedGitState === undefined) {
								throw new Error('Could not determine retained content files for combined output');
							}
							cleanupCombinedState(
								gitStateEntrypoint,
								collectedGitInformation!,
								retainedContentFiles,
								initialSerializedGitState,
								gitStateStart,
								gitStateEnd,
								loadCommitContent
							);
						}
					} finally {
						if (buildContentLoaderRegistered) {
							const registration = Reflect.get(
								globalThis,
								buildContentLoaderSymbol
							) as BuildContentLoaderRegistration;
							registration.references -= 1;
							if (registration.references === 0) {
								Reflect.deleteProperty(globalThis, buildContentLoaderSymbol);
							}
							buildContentLoaderRegistered = false;
						}
					}
				});
			}
		},
		async load(id, { ssr } = {}) {
			if (!ssr) return;

			if (id === RESOLVED_MODULE_ID) return buildFacade(projectRoot);

			if (id === RESOLVED_INNER_MODULE_ID) {
				debug('Registering project root:', projectRoot);
				liveGit.setProjectRoot(projectRoot);
				liveGit.setCollectCommitHistory(state.collectCommitHistory);
				if (!buildContentLoaderRegistered) {
					const registration = Reflect.get(globalThis, buildContentLoaderSymbol) as
						| BuildContentLoaderRegistration
						| undefined;
					if (registration === undefined) {
						Reflect.set(globalThis, buildContentLoaderSymbol, {
							loadContent: loadCommitContent,
							references: 1,
						} satisfies BuildContentLoaderRegistration);
					} else {
						registration.references += 1;
					}
					buildContentLoaderRegistered = true;
				}
				const trackedFiles = await liveGit.collectGitInfoForContentFiles(loadCommitContent);
				collectedGitInformation = new Map(trackedFiles);
				debug('Git tracked file dates:', trackedFiles);

				initialSerializedGitState = serializeGitState(
					collectedGitInformation,
					gitStateStart,
					gitStateEnd
				);
				return `const trackedFilesPayload = ${JSON.stringify(initialSerializedGitState)};
const trackedFilesBytes = Uint8Array.from(atob(trackedFilesPayload.slice(${gitStateStart.length}, -${gitStateEnd.length})), (byte) => byte.charCodeAt(0));
const trackedFiles = JSON.parse(new TextDecoder().decode(trackedFilesBytes));
export { trackedFiles as default };`;
			}
		},
	};
};

type BuildContentLoaderRegistration = {
	loadContent: (hash: string, repoPath: string) => string;
	references: number;
};

type BuildCommitInfo = {
	hash: string;
	repoPath?: string;
	content?: string;
};

type BuildGitTrackingInfo = {
	commits: BuildCommitInfo[];
};

function serializeGitState(
	gitInformation: Map<string, BuildGitTrackingInfo>,
	stateStart: string,
	stateEnd: string
): string {
	return `${stateStart}${Buffer.from(devalue.stringify(gitInformation)).toString('base64')}${stateEnd}`;
}

function materializeCommitContent(
	fileInfo: BuildGitTrackingInfo,
	loadCommitContent: (hash: string, repoPath: string) => string
): void {
	for (const commit of fileInfo.commits) {
		if (commit.content === undefined) {
			if (commit.repoPath === undefined) {
				throw new Error(`Missing repository path for commit ${commit.hash}`);
			}
			commit.content = loadCommitContent(commit.hash, commit.repoPath);
		}
		delete commit.repoPath;
	}
}
async function cleanupState(
	contentData: string,
	gitState: string,
	loadCommitContent: (hash: string, repoPath: string) => string
): Promise<void> {
	if (!existsSync(contentData) || !existsSync(gitState)) return;

	const originalContent = readFileSync(gitState, 'utf-8');

	// Content was already cleared by Astro. Collections are not used anywhere on server bundle
	if (!originalContent.includes('export')) return;

	// Import the chunk, which exports a devalue flattened map as the default export
	const { default: contentValue } = await import(
		/*@vite-ignore*/ `${pathToFileURL(contentData).href}?git-cleanup`
	);
	const { default: gitValue } = await import(/*@vite-ignore*/ gitState);

	// Unflatten the map
	const contentMap: Map<string, Map<string, unknown>> = devalue.unflatten(contentValue);
	const gitInformation: Map<string, BuildGitTrackingInfo> = devalue.unflatten(gitValue);

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

	// Content must be stored in the final bundle because Git history may be unavailable at runtime.
	for (const fileInfo of cleanedMap.values()) {
		materializeCommitContent(fileInfo, loadCommitContent);
	}
	// Build the source code with the new map flattened
	const newContent = [
		`const trackedFiles = ${devalue.stringify(cleanedMap)}`,
		'\nexport { trackedFiles as default }',
	].join('\n');

	// Write it back
	writeFileSync(gitState, newContent, 'utf-8');
}

function cleanupCombinedState(
	gitState: string,
	gitInformation: Map<string, BuildGitTrackingInfo>,
	retainedContentFiles: Set<string>,
	initialSerializedState: string,
	stateStartToken: string,
	stateEndToken: string,
	loadCommitContent: (hash: string, repoPath: string) => string
): void {
	const retainedGitInformation = new Map(
		Array.from(gitInformation.entries()).filter(([path]) => retainedContentFiles.has(path))
	);
	for (const fileInfo of retainedGitInformation.values()) {
		materializeCommitContent(fileInfo, loadCommitContent);
	}

	const originalContent = readFileSync(gitState, 'utf-8');
	const stateStart = originalContent.indexOf(initialSerializedState);
	if (
		stateStart === -1 ||
		originalContent.indexOf(initialSerializedState, stateStart + initialSerializedState.length) !==
			-1
	) {
		throw new Error(
			'Could not uniquely locate serialized Git history in the combined output chunk'
		);
	}

	const serializedState = serializeGitState(retainedGitInformation, stateStartToken, stateEndToken);
	writeFileSync(
		gitState,
		`${originalContent.slice(0, stateStart)}${serializedState}${originalContent.slice(
			stateStart + initialSerializedState.length
		)}`,
		'utf-8'
	);
}

const buildFacade = (projectRoot: string) => `
import {getEntry} from 'astro:content';
import {unflatten} from ${JSON.stringify(import.meta.resolve('devalue'))};
import {Lazy} from ${JSON.stringify(import.meta.resolve('@inox-tools/utils/lazy'))};

const buildContentLoader = globalThis[Symbol.for(${JSON.stringify(
	`@inox-tools/content-utils:build-content:${projectRoot}`
)})]?.loadContent;

const trackedFiles = unflatten((await import(${JSON.stringify(INNER_MODULE_ID)})).default);

function buildCommitInfo(c) {
	const ci = {
		hash: c.hash,
		date: new Date(c.date),
		author: c.author,
		coAuthors: Array.from(c.coAuthors),
	};
	const lazyContent = Lazy.wrap(() => buildContentLoader?.(c.hash, c.repoPath) ?? '');
	Object.defineProperty(ci, 'content', {
		get: () => c.content ?? lazyContent(),
		set: (content) => {
			c.content = content;
		},
		enumerable: true,
	});
	return ci;
}

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
		commits: (rawInfo.commits || []).map(buildCommitInfo),
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
