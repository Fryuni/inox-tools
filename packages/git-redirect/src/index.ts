import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stat, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const supportedExtensions: Record<string, true> = {
	'.astro': true,
	'.md': true,
	'.mdx': true,
};

export interface GitRedirectSource {
	path: string;
	prefix: string;
}

type ResolvedSource = {
	path: string;
	prefix: string;
	routeRoot: string;
	repository: string;
	file: boolean;
};

type Rename = {
	from: string;
	to: string;
};

export default function gitRedirect(sources: GitRedirectSource[]): AstroIntegration {
	return {
		name: '@inox-tools/git-redirect',
		hooks: {
			'astro:config:setup': async ({ config, updateConfig }) => {
				const root = fileURLToPath(config.root);
				const resolvedSources = await Promise.all(
					sources.map((source) => resolveSource(root, source))
				);
				const renamesByRepository = await getRepositoryRenames(resolvedSources);
				const existingRedirects = config.redirects ?? {};
				const generatedRedirects: Record<string, string> = {};
				const currentRoutes = new Set<string>();
				for (const routes of await Promise.all(resolvedSources.map(getCurrentRoutes))) {
					for (const route of routes) currentRoutes.add(route);
				}

				for (const source of resolvedSources) {
					const renames = renamesByRepository.get(source.repository);
					if (!renames) continue;

					for (const [from, to] of renames) {
						if (!hasSupportedExtension(from) || !hasSupportedExtension(to)) continue;

						const previousPath = resolveRepositoryPath(source.repository, from);
						const currentPath = resolveRepositoryPath(source.repository, to);
						const outsideSource = source.file
							? currentPath !== source.path || !isWithin(source.routeRoot, previousPath)
							: !isWithin(source.path, previousPath) || !isWithin(source.path, currentPath);
						if (outsideSource) continue;
						if (!(await isFile(currentPath))) continue;

						const redirectFrom = toRoute(source, previousPath);
						const redirectTo = toRoute(source, currentPath);
						if (
							redirectFrom === redirectTo ||
							currentRoutes.has(redirectFrom) ||
							Object.hasOwn(existingRedirects, redirectFrom) ||
							Object.hasOwn(generatedRedirects, redirectFrom)
						) {
							continue;
						}

						generatedRedirects[redirectFrom] = redirectTo;
					}
				}

				updateConfig({ redirects: generatedRedirects });
			},
		},
	};
}

async function resolveSource(root: string, source: GitRedirectSource): Promise<ResolvedSource> {
	const sourcePath = path.resolve(root, source.path);
	const sourceStat = await getSourceStat(sourcePath);
	const file = sourceStat.isFile();
	const routeRoot = file ? path.dirname(sourcePath) : sourcePath;
	const repository = await getRepository(routeRoot, sourcePath);

	if (!isWithin(repository, sourcePath)) {
		throw new Error(
			`@inox-tools/git-redirect: source path ${source.path} is outside its containing Git repository (${repository}).`
		);
	}

	return { path: sourcePath, prefix: source.prefix, routeRoot, repository, file };
}

async function getSourceStat(sourcePath: string) {
	try {
		return await stat(sourcePath);
	} catch (error) {
		throw new Error(
			`@inox-tools/git-redirect: source path ${sourcePath} cannot be read. Configure an existing file or directory.`,
			{ cause: error }
		);
	}
}

async function getRepository(directory: string, sourcePath: string): Promise<string> {
	const output = await runGit(
		directory,
		['rev-parse', '--show-toplevel'],
		'find the containing repository'
	);
	const repositoryPath = output.toString('utf8').replace(/[\r\n]+$/, '');

	if (!repositoryPath) {
		throw new Error(
			`@inox-tools/git-redirect: Git did not return a repository for source path ${sourcePath}.`
		);
	}

	return path.resolve(repositoryPath);
}

async function getRepositoryRenames(
	sources: ResolvedSource[]
): Promise<Map<string, Map<string, string>>> {
	const repositories = new Set(sources.map((source) => source.repository));
	const entries = await Promise.all(
		[...repositories].map(
			async (repository) => [repository, await getRenameTargets(repository)] as const
		)
	);

	return new Map(entries);
}

async function getRenameTargets(repository: string): Promise<Map<string, string>> {
	const output = await runGit(
		repository,
		[
			'log',
			'--format=%x00',
			'--name-status',
			'-z',
			'--find-renames',
			'--diff-filter=R',
			'HEAD',
			'--',
		],
		'inspect rename history at HEAD'
	);

	const targets = new Map<string, string>();
	for (const rename of parseRenames(output)) {
		if (targets.has(rename.from)) continue;
		targets.set(rename.from, targets.get(rename.to) ?? rename.to);
	}

	return targets;
}

function parseRenames(output: Buffer): Rename[] {
	const fields = splitNulFields(output);
	const renames: Rename[] = [];

	for (let index = 0; index < fields.length; index += 1) {
		const status = fields[index].trim();
		if (!/^R\d+$/.test(status)) continue;

		const from = fields[index + 1];
		const to = fields[index + 2];
		if (from === undefined || to === undefined) {
			throw new Error('@inox-tools/git-redirect: Git returned an incomplete rename record.');
		}

		renames.push({ from, to });
		index += 2;
	}

	return renames;
}

function splitNulFields(output: Buffer): string[] {
	const fields: string[] = [];
	let start = 0;

	for (let end = output.indexOf(0, start); end !== -1; end = output.indexOf(0, start)) {
		fields.push(output.subarray(start, end).toString('utf8'));
		start = end + 1;
	}

	if (start < output.length) fields.push(output.subarray(start).toString('utf8'));
	return fields;
}

async function getCurrentRoutes(source: ResolvedSource): Promise<Set<string>> {
	const files = await getSourceFiles(source.path);
	return new Set(files.filter(hasSupportedExtension).map((file) => toRoute(source, file)));
}

async function getSourceFiles(sourcePath: string): Promise<string[]> {
	const sourceStat = await stat(sourcePath);
	if (sourceStat.isFile()) return [sourcePath];
	if (!sourceStat.isDirectory()) return [];

	const files: string[] = [];
	for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
		const entryPath = path.join(sourcePath, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await getSourceFiles(entryPath)));
		} else if (entry.isFile()) {
			files.push(entryPath);
		}
	}

	return files;
}

function hasSupportedExtension(filePath: string): boolean {
	const extension = path.extname(filePath);
	return Object.hasOwn(supportedExtensions, extension);
}

async function isFile(filePath: string): Promise<boolean> {
	try {
		return (await stat(filePath)).isFile();
	} catch (error: unknown) {
		if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
			return false;
		}
		throw new Error(`@inox-tools/git-redirect: cannot inspect current file ${filePath}.`, {
			cause: error,
		});
	}
}

function resolveRepositoryPath(repository: string, gitPath: string): string {
	const resolved = path.resolve(repository, ...gitPath.split('/'));
	if (!isWithin(repository, resolved)) {
		throw new Error(
			`@inox-tools/git-redirect: Git returned a path outside the repository: ${gitPath}.`
		);
	}

	return resolved;
}

function isWithin(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return (
		relative === '' ||
		(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
	);
}

function toRoute(source: ResolvedSource, filePath: string): string {
	const relative = path.relative(source.routeRoot, filePath);
	const withoutExtension = relative.slice(0, -path.extname(relative).length);
	const segments = withoutExtension.split(path.sep);
	if (segments.at(-1) === 'index') segments.pop();

	return path.posix.join(normalizePrefix(source.prefix), ...segments);
}

function normalizePrefix(prefix: string): string {
	const normalized = path.posix.normalize(`/${prefix}`);
	return normalized === '/' ? normalized : normalized.replace(/\/+$/, '');
}

async function runGit(directory: string, args: string[], action: string): Promise<Buffer> {
	const command = ['git', '-C', directory, ...args].join(' ');
	const child = spawn('git', ['-C', directory, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
	const stdout: Buffer[] = [];
	const stderr: Buffer[] = [];

	child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
	child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

	let code: number | null;
	let signal: NodeJS.Signals | null;
	try {
		[code, signal] = (await once(child, 'close')) as [number | null, NodeJS.Signals | null];
	} catch (error) {
		throw new Error(
			`@inox-tools/git-redirect: failed to ${action}. Ensure Git is installed and ${directory} is accessible. (${command})`,
			{ cause: error }
		);
	}

	if (code === 0) return Buffer.concat(stdout);

	const detail = Buffer.concat(stderr).toString('utf8').trim();
	throw new Error(
		`@inox-tools/git-redirect: failed to ${action} in ${directory}${
			code === null ? ` (terminated by ${signal ?? 'an unknown signal'})` : ` (exit code ${code})`
		}.${detail ? ` ${detail}` : ''} Command: ${command}`
	);
}
