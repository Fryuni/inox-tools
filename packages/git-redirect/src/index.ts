import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { realpath, readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const supportedExtensions: Record<string, true> = {
	'.astro': true,
	'.html': true,
	'.md': true,
	'.mdx': true,
	'.markdown': true,
	'.mdown': true,
	'.mkdn': true,
	'.mkd': true,
	'.mdwn': true,
	'.js': true,
	'.ts': true,
};

/**
 * A path whose Git rename history generates Astro redirects.
 */
export interface GitRedirectSource {
	/**
	 * An existing file or directory, resolved relative to the Astro project root (unless absolute).
	 *
	 * A file generates redirects for that page; a directory generates redirects for supported pages within it. A
	 * supported page file has a `.astro`, `.html`, `.md`, `.mdx`, `.markdown`, `.mdown`, `.mkdn`, `.mkd`, `.mdwn`,
	 * `.js`, or `.ts` extension. Within Astro's pages directory, its path cannot contain a component beginning with
	 * `_` or `.`, except for `.well-known`.
	 */
	path: string;
	/**
	 * The URL prefix for generated routes.
	 *
	 * It is normalized to a leading slash, with trailing slashes removed except for the root,
	 * before being joined to page routes.
	 */
	prefix: string;
}

type ResolvedSource = {
	path: string;
	prefix: string;
	routeRoot: string;
	repository: string;
	file: boolean;
	pagesRoot?: string;
};

type HistoryEntry =
	| { kind: 'add'; path: string }
	| { kind: 'delete'; path: string }
	| { kind: 'rename'; from: string; to: string };

type HistoryCommit = {
	entries: HistoryEntry[];
};

/**
 * Creates an Astro integration that generates redirects from Git rename history.
 *
 * Sources may be files or directories and are processed in order; for a generated-route collision, the
 * earlier source wins. Existing routes and explicitly configured redirects always take precedence.
 *
 * Each source's containing repository must have complete, non-shallow history available at build time.
 */
export default function gitRedirect(sources: GitRedirectSource[]): AstroIntegration {
	return {
		name: '@inox-tools/git-redirect',
		hooks: {
			'astro:config:setup': async ({ config, updateConfig }) => {
				const root = fileURLToPath(config.root);
				const pagesRoot = path.join(fileURLToPath(config.srcDir), 'pages');
				const resolvedSources = await Promise.all(
					sources.map((source) => resolveSource(root, pagesRoot, source))
				);
				const sourceFiles = await Promise.all(
					resolvedSources.map((source) =>
						getSourceFiles(source.path, source.pagesRoot, source.repository)
					)
				);
				const historiesByRepository = await getRepositoryHistories(resolvedSources);
				const existingRedirects = config.redirects ?? {};
				const generatedRedirects: Record<string, string> = {};
				const currentRoutes = await getAstroPageRoutes(pagesRoot, root);
				for (const routes of await Promise.all(resolvedSources.map(getCurrentRoutes))) {
					for (const route of routes) currentRoutes.add(route);
				}

				for (const [index, source] of resolvedSources.entries()) {
					const history = historiesByRepository.get(source.repository);
					if (!history) continue;

					const currentPaths = sourceFiles[index].map((file) =>
						toRepositoryPath(source.repository, file)
					);
					const renames = resolveRenameTargets(history, currentPaths);
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
							!hasMatchingParameterBindings(redirectFrom, redirectTo) ||
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

async function resolveSource(
	root: string,
	pagesRoot: string,
	source: GitRedirectSource
): Promise<ResolvedSource> {
	const sourcePath = path.resolve(root, source.path);
	const sourceStat = await getSourceStat(sourcePath);
	const sourceRealPath = await realpath(sourcePath);
	const file = sourceStat.isFile();
	const routeRoot = file ? path.dirname(sourcePath) : sourcePath;
	const repository = await getRepository(routeRoot, sourcePath);

	if (!isWithin(repository, sourcePath) || !isWithin(await realpath(repository), sourceRealPath)) {
		throw new Error(
			`@inox-tools/git-redirect: source path ${source.path} is outside its containing Git repository (${repository}).`
		);
	}

	return {
		path: sourcePath,
		prefix: source.prefix,
		routeRoot,
		repository,
		file,
		pagesRoot: isWithin(pagesRoot, sourcePath) ? pagesRoot : undefined,
	};
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

async function getRepositoryHistories(
	sources: ResolvedSource[]
): Promise<Map<string, HistoryCommit[]>> {
	const repositories = new Set(sources.map((source) => source.repository));
	const entries = await Promise.all(
		[...repositories].map(
			async (repository) => [repository, await getRepositoryHistory(repository)] as const
		)
	);

	return new Map(entries);
}

async function getRepositoryHistory(repository: string): Promise<HistoryCommit[]> {
	const shallow = await runGit(
		repository,
		['rev-parse', '--is-shallow-repository'],
		'check whether Git history is complete'
	);
	if (shallow.toString('utf8').trim() === 'true') {
		throw new Error(
			`@inox-tools/git-redirect: repository ${repository} has shallow Git history. Fetch the full history before building redirects (for GitHub Actions, set fetch-depth: 0).`
		);
	}

	const output = await runGit(
		repository,
		[
			'log',
			'--format=%x00%H%x00',
			'--name-status',
			'-z',
			'-l0',
			'--find-renames',
			'--diff-filter=ARD',
			'--first-parent',
			'--diff-merges=first-parent',
			'HEAD',
			'--',
		],
		'inspect first-parent rename history at HEAD'
	);

	return parseHistory(output);
}

function parseHistory(output: Buffer): HistoryCommit[] {
	const fields = splitNulFields(output);
	const commits: HistoryCommit[] = [];
	let index = 0;

	while (index < fields.length) {
		if (!isCommitFrame(fields, index)) {
			throw new Error('@inox-tools/git-redirect: Git returned malformed commit history.');
		}
		index += 3;

		const entries: HistoryEntry[] = [];
		while (index < fields.length && !isCommitFrame(fields, index)) {
			const status = fields[index].trim();
			if (status === 'A' || status === 'D') {
				const filePath = fields[index + 1];
				if (filePath === undefined) {
					throw new Error('@inox-tools/git-redirect: Git returned an incomplete history entry.');
				}
				entries.push({ kind: status === 'A' ? 'add' : 'delete', path: filePath });
				index += 2;
				continue;
			}

			if (/^R\d+$/.test(status)) {
				const from = fields[index + 1];
				const to = fields[index + 2];
				if (from === undefined || to === undefined) {
					throw new Error('@inox-tools/git-redirect: Git returned an incomplete rename record.');
				}
				entries.push({ kind: 'rename', from, to });
				index += 3;
				continue;
			}

			throw new Error(
				`@inox-tools/git-redirect: Git returned an unsupported history status: ${status}.`
			);
		}

		commits.push({ entries });
	}

	return commits;
}

function isCommitFrame(fields: string[], index: number): boolean {
	return (
		fields[index] === '' &&
		/^[0-9a-f]{40,64}$/i.test(fields[index + 1] ?? '') &&
		fields[index + 2] === ''
	);
}

function resolveRenameTargets(
	commits: HistoryCommit[],
	currentPaths: Iterable<string>
): Map<string, string> {
	let paths = new Map<string, string | undefined>();
	for (const currentPath of currentPaths) paths.set(currentPath, currentPath);

	const targets = new Map<string, string>();
	const birthsCrossed = new Set<string>();
	for (const commit of commits) {
		const before = new Map(paths);

		for (const entry of commit.entries) {
			if (entry.kind === 'add') {
				before.delete(entry.path);
				birthsCrossed.add(entry.path);
			}
		}
		for (const entry of commit.entries) {
			if (entry.kind === 'delete') before.set(entry.path, undefined);
		}
		for (const entry of commit.entries) {
			if (entry.kind !== 'rename') continue;

			const target = paths.get(entry.to);
			before.delete(entry.to);
			before.set(entry.from, target);
			if (target !== undefined && !targets.has(entry.from) && !birthsCrossed.has(entry.from)) {
				targets.set(entry.from, target);
			}
		}

		paths = before;
	}

	return targets;
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

async function getAstroPageRoutes(pagesRoot: string, root: string): Promise<Set<string>> {
	try {
		let repository = root;
		try {
			repository = await getRepository(root, root);
		} catch {
			repository = root;
		}
		const files = await getSourceFiles(pagesRoot, pagesRoot, repository);
		return new Set(
			files
				.filter(hasSupportedExtension)
				.map((file) => toRoute({ prefix: '/', routeRoot: pagesRoot }, file))
		);
	} catch (error: unknown) {
		if (isNotFound(error)) return new Set();
		throw error;
	}
}

async function getCurrentRoutes(source: ResolvedSource): Promise<Set<string>> {
	const files = await getSourceFiles(source.routeRoot, source.pagesRoot, source.repository);
	return new Set(files.filter(hasSupportedExtension).map((file) => toRoute(source, file)));
}

async function getSourceFiles(
	sourcePath: string,
	pagesRoot?: string,
	repository?: string
): Promise<string[]> {
	return collectSourceFiles(
		sourcePath,
		pagesRoot,
		repository ? await realpath(repository) : undefined,
		new Set()
	);
}

async function collectSourceFiles(
	sourcePath: string,
	pagesRoot: string | undefined,
	repository: string | undefined,
	ancestors: ReadonlySet<string>
): Promise<string[]> {
	if (!isIncludedPagePath(sourcePath, pagesRoot)) return [];

	let realSourcePath: string;
	try {
		realSourcePath = await realpath(sourcePath);
	} catch (error: unknown) {
		if (isNotFound(error)) return [];
		throw error;
	}
	if (repository && !isWithin(repository, realSourcePath)) return [];

	const sourceStat = await stat(sourcePath);
	if (sourceStat.isFile()) return [sourcePath];
	if (!sourceStat.isDirectory() || ancestors.has(realSourcePath)) return [];

	const nextAncestors = new Set(ancestors).add(realSourcePath);
	const files: string[] = [];
	for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
		if (
			entry.name === '.git' ||
			(pagesRoot &&
				(entry.name.startsWith('_') ||
					(entry.name.startsWith('.') && entry.name !== '.well-known')))
		) {
			continue;
		}

		const entryPath = path.join(sourcePath, entry.name);
		const entryStat = await stat(entryPath);
		if (entryStat.isDirectory()) {
			if (await hasGitMetadata(entryPath)) continue;
			files.push(...(await collectSourceFiles(entryPath, pagesRoot, repository, nextAncestors)));
		} else if (entryStat.isFile()) {
			files.push(...(await collectSourceFiles(entryPath, pagesRoot, repository, nextAncestors)));
		}
	}

	return files;
}

function isIncludedPagePath(sourcePath: string, pagesRoot?: string): boolean {
	if (!pagesRoot || !isWithin(pagesRoot, sourcePath)) return true;

	return path
		.relative(pagesRoot, sourcePath)
		.split(path.sep)
		.every(
			(segment) =>
				!segment.startsWith('_') && (!segment.startsWith('.') || segment === '.well-known')
		);
}

async function hasGitMetadata(directory: string): Promise<boolean> {
	try {
		await stat(path.join(directory, '.git'));
		return true;
	} catch (error: unknown) {
		if (isNotFound(error)) return false;
		throw new Error(`@inox-tools/git-redirect: cannot inspect nested repository ${directory}.`, {
			cause: error,
		});
	}
}

function hasMatchingParameterBindings(from: string, to: string): boolean {
	const fromBindings = [...from.matchAll(/\[(\.\.\.)?([^/\]]+)\]/g)].map(
		(match) => `${match[1] ?? ''}${match[2]}`
	);
	const toBindings = [...to.matchAll(/\[(\.\.\.)?([^/\]]+)\]/g)].map(
		(match) => `${match[1] ?? ''}${match[2]}`
	);
	return (
		fromBindings.length === toBindings.length &&
		fromBindings.every((binding, index) => binding === toBindings[index])
	);
}

function toRepositoryPath(repository: string, filePath: string): string {
	const relative = path.relative(repository, filePath);
	if (!relative || !isWithin(repository, filePath)) {
		throw new Error(
			`@inox-tools/git-redirect: current file is outside the repository: ${filePath}.`
		);
	}

	return relative.split(path.sep).join('/');
}

function isNotFound(error: unknown): error is { code: 'ENOENT' } {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function hasSupportedExtension(filePath: string): boolean {
	const extension = path.extname(filePath);
	return Object.hasOwn(supportedExtensions, extension);
}

async function isFile(filePath: string): Promise<boolean> {
	try {
		return (await stat(filePath)).isFile();
	} catch (error: unknown) {
		if (isNotFound(error)) return false;
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

function toRoute(source: Pick<ResolvedSource, 'prefix' | 'routeRoot'>, filePath: string): string {
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
