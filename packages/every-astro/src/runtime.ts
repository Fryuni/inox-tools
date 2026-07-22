import type { ChildProcess, spawn as NodeSpawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	readlink,
	realpath,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';

import type { BisectSession, EveryAstroDependencies } from './workflow.js';

const ASTRO_REPOSITORY = 'https://github.com/withastro/astro.git';
const PACKAGE_MANAGERS = ['pnpm', 'yarn', 'bun', 'npm'] as const;

const runtimeRequire = createRequire(import.meta.url);
const spawn = runtimeRequire('cross-spawn') as typeof NodeSpawn;
const corepackCli = join(
	dirname(runtimeRequire.resolve('corepack/package.json')),
	'dist',
	'corepack.js'
);

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

type PackageManifest = {
	name?: string;
	version?: string;
	private?: boolean;
	packageManager?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	resolutions?: Record<string, string>;
};

type CommandOptions = {
	capture?: boolean;
	env?: NodeJS.ProcessEnv;
	ignoreAbort?: boolean;
};

class CommandError extends Error {
	public constructor(
		readonly command: readonly string[],
		readonly cwd: string,
		readonly exitCode: number | null,
		readonly output: string
	) {
		super(
			`Command failed (${exitCode ?? 'signal'}): ${command.join(' ')}\nWorking directory: ${cwd}${output ? `\n${output}` : ''}`
		);
		this.name = 'CommandError';
	}
}

function commandText(command: readonly string[]): string {
	return command.map((part) => JSON.stringify(part)).join(' ');
}

/** Windows launches commands through this supervisor so target processes join a kill-on-close Job Object. */
export function windowsJobSupervisorCommand(controlFile: string): [string, ...string[]] {
	return [
		'powershell.exe',
		'-NoProfile',
		'-NonInteractive',
		'-ExecutionPolicy',
		'Bypass',
		'-File',
		runtimeRequire.resolve('../src/windows-job-supervisor.ps1'),
		'-ControlFile',
		controlFile,
	];
}

const WINDOWS_CMD_META_CHARACTERS = /([()\][%!^"`<>&|;, *?])/g;
const WINDOWS_CMD_SHIM = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i;

/** Build the raw `/d /s /c` tail using cross-spawn's Windows escaping semantics. */
export function windowsBatchCommandTail(file: string, args: readonly string[]): string {
	const doubleEscapeMetaCharacters = WINDOWS_CMD_SHIM.test(file);
	const command = file.replaceAll('/', '\\').replace(WINDOWS_CMD_META_CHARACTERS, '^$1');
	const escapedArguments = args.map((argument) => {
		let escaped = `${argument}`;
		escaped = escaped.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
		escaped = escaped.replace(/(?=(\\+?)?)\1$/, '$1$1');
		escaped = `"${escaped}"`.replace(WINDOWS_CMD_META_CHARACTERS, '^$1');
		return doubleEscapeMetaCharacters
			? escaped.replace(WINDOWS_CMD_META_CHARACTERS, '^$1')
			: escaped;
	});
	return `/d /s /c "${[command, ...escapedArguments].join(' ')}"`;
}

/** Development servers must not consume the terminal input reserved for the bisect prompt. */
export const developmentServerStdio: ['ignore', 'inherit', 'inherit'] = [
	'ignore',
	'inherit',
	'inherit',
];

async function readManifest(path: string): Promise<PackageManifest> {
	return JSON.parse(await readFile(path, 'utf8')) as PackageManifest;
}

async function existingManifest(path: string): Promise<PackageManifest | undefined> {
	try {
		return await readManifest(path);
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw error;
	}
}

type DetectedPackageManager = {
	manager: PackageManager;
	root: string;
};

const LOCKFILES: readonly [string, PackageManager][] = [
	['pnpm-lock.yaml', 'pnpm'],
	['yarn.lock', 'yarn'],
	['bun.lockb', 'bun'],
	['bun.lock', 'bun'],
	['package-lock.json', 'npm'],
	['npm-shrinkwrap.json', 'npm'],
];

async function findManagerLockfileRoot(
	manager: PackageManager,
	fromDirectory: string
): Promise<string | undefined> {
	let directory = resolve(fromDirectory);
	while (true) {
		if (existsSync(managerLockfile(manager, directory))) return directory;
		const parent = dirname(directory);
		if (parent === directory) return undefined;
		directory = parent;
	}
}

async function detectPackageManagerInfo(projectRoot: string): Promise<DetectedPackageManager> {
	let directory = resolve(projectRoot);
	while (true) {
		const manifest = await existingManifest(join(directory, 'package.json'));
		const configured = manifest?.packageManager?.split('@', 1)[0];
		if (configured && (PACKAGE_MANAGERS as readonly string[]).includes(configured)) {
			const manager = configured as PackageManager;
			return {
				manager,
				root: (await findManagerLockfileRoot(manager, directory)) ?? directory,
			};
		}
		for (const [lockfile, manager] of LOCKFILES) {
			if (existsSync(join(directory, lockfile))) return { manager, root: directory };
		}
		const parent = dirname(directory);
		if (parent === directory) return { manager: 'npm', root: resolve(projectRoot) };
		directory = parent;
	}
}

/** Detect the nearest package manager declaration or conventional lockfile. */
export async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
	return (await detectPackageManagerInfo(projectRoot)).manager;
}

/** Locate the lockfile root used by the selected package manager. */
export async function detectPackageManagerRoot(projectRoot: string): Promise<string> {
	return (await detectPackageManagerInfo(projectRoot)).root;
}

type PnpApi = {
	resolveToUnqualified: (request: string, issuer: string) => string | null;
	setup?: () => void;
};

const pnpApis = new Map<string, PnpApi>();

function nearestPnpPath(fromDirectory: string): string | undefined {
	let directory = resolve(fromDirectory);
	while (true) {
		for (const filename of ['.pnp.cjs', '.pnp.js']) {
			const pnpPath = join(directory, filename);
			if (existsSync(pnpPath)) return pnpPath;
		}
		const parent = dirname(directory);
		if (parent === directory) return undefined;
		directory = parent;
	}
}

function loadPnpApi(pnpPath: string | undefined): PnpApi | undefined {
	if (!pnpPath) return undefined;
	const cached = pnpApis.get(pnpPath);
	if (cached) return cached;

	const pnpapi = runtimeRequire(pnpPath) as PnpApi;
	pnpapi.setup?.();
	pnpApis.set(pnpPath, pnpapi);
	return pnpapi;
}

async function manifestAt(path: string, packageName: string): Promise<string | undefined> {
	const manifest = await existingManifest(path);
	return manifest?.name === packageName ? path : undefined;
}

async function packageManifestFromNodeModules(
	requireFrom: NodeJS.Require,
	packageName: string
): Promise<string | undefined> {
	for (const nodeModules of requireFrom.resolve.paths(packageName) ?? []) {
		const manifestPath = await manifestAt(
			join(nodeModules, packageName, 'package.json'),
			packageName
		);
		if (manifestPath) return realpath(manifestPath);
	}
	return undefined;
}

async function packageManifestFromPnp(
	pnpapi: PnpApi | undefined,
	packageName: string,
	fromDirectory: string
): Promise<string | undefined> {
	if (!pnpapi) return undefined;
	try {
		const packageRoot = pnpapi.resolveToUnqualified(
			packageName,
			join(fromDirectory, 'package.json')
		);
		return packageRoot
			? await manifestAt(join(packageRoot, 'package.json'), packageName)
			: undefined;
	} catch {
		return undefined;
	}
}
async function packageManifestFromEntry(
	entry: string,
	packageName: string
): Promise<string | undefined> {
	let directory = dirname(entry);
	while (directory !== dirname(directory)) {
		const manifestPath = join(directory, 'package.json');
		const manifest = await existingManifest(manifestPath);
		if (manifest?.name === packageName) return manifestPath;
		directory = dirname(directory);
	}
	return undefined;
}

/** Resolve a package manifest even when its package.json subpath is not exported. */
export async function resolveInstalledPackageManifest(
	packageName: string,
	fromDirectory: string,
	pnpPath = nearestPnpPath(fromDirectory)
): Promise<string | undefined> {
	const pnpapi = loadPnpApi(pnpPath);
	const requireFrom = createRequire(join(fromDirectory, 'package.json'));
	const pnpManifest = await packageManifestFromPnp(pnpapi, packageName, fromDirectory);
	if (pnpManifest) return pnpManifest;
	try {
		const manifestPath = await manifestAt(
			requireFrom.resolve(`${packageName}/package.json`),
			packageName
		);
		if (manifestPath) return manifestPath;
	} catch {
		// Package manifests are commonly hidden by package export maps.
	}
	const nodeModulesManifest = await packageManifestFromNodeModules(requireFrom, packageName);
	if (nodeModulesManifest) return nodeModulesManifest;
	try {
		return await packageManifestFromEntry(requireFrom.resolve(packageName), packageName);
	} catch {
		return undefined;
	}
}

function astroMajorFromVersion(version: string | undefined): number | undefined {
	const major = version ? Number.parseInt(version.split('.', 1)[0]!, 10) : Number.NaN;
	return Number.isSafeInteger(major) && major >= 0 ? major : undefined;
}

/** Find the locally installed Astro version and return its parsed major number. */
export async function installedAstroMajor(projectRoot: string): Promise<number> {
	const manifestPath = await resolveInstalledPackageManifest('astro', projectRoot);
	if (!manifestPath) {
		throw new Error(`Could not resolve the installed Astro package from ${projectRoot}`);
	}
	const version = (await readManifest(manifestPath)).version;
	const major = astroMajorFromVersion(version);
	if (major === undefined) {
		throw new Error(
			`Installed Astro at ${manifestPath} has an invalid version: ${version ?? 'missing'}`
		);
	}
	return major;
}

function packageDependencies(manifest: PackageManifest, includeDevDependencies = false): string[] {
	return Object.keys({
		...manifest.dependencies,
		...manifest.optionalDependencies,
		...manifest.peerDependencies,
		...(includeDevDependencies ? manifest.devDependencies : undefined),
	});
}

/**
 * Walk manifests resolved from the project rather than assuming a node_modules layout.
 * This works with scoped names, pnpm's virtual store, and package export maps.
 */
export async function collectInstalledDependencyNames(projectRoot: string): Promise<Set<string>> {
	const rootManifest = await readManifest(join(projectRoot, 'package.json'));
	const pnpPath = nearestPnpPath(projectRoot);
	loadPnpApi(pnpPath);
	const pending = packageDependencies(rootManifest, true).map((name) => ({
		name,
		from: projectRoot,
	}));
	const names = new Set<string>();
	const visitedManifests = new Set<string>();

	while (pending.length > 0) {
		const dependency = pending.pop()!;
		const manifestPath = await resolveInstalledPackageManifest(
			dependency.name,
			dependency.from,
			pnpPath
		);
		if (!manifestPath || visitedManifests.has(manifestPath)) continue;

		visitedManifests.add(manifestPath);
		const manifest = await readManifest(manifestPath);
		if (!manifest.name) continue;
		names.add(manifest.name);
		for (const name of packageDependencies(manifest)) {
			pending.push({ name, from: dirname(manifestPath) });
		}
	}

	return names;
}

async function walkPackageManifests(
	directory: string,
	manifests: Map<string, string>
): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name === '.git' || entry.name === 'node_modules') continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			await walkPackageManifests(path, manifests);
			continue;
		}
		if (!entry.isFile() || entry.name !== 'package.json') continue;

		const manifest = await existingManifest(path);
		if (!manifest?.name || manifest.private) continue;
		if (manifest.name === 'astro' || manifest.name.startsWith('@astrojs/')) {
			manifests.set(manifest.name, dirname(path));
		}
	}
}

const BISECT_COMPLETION = /["']?([0-9a-f]{7,40})["']?\s+is the first\s+["']?bad["']?\s+commit\b/i;

/** Extract the completed bisect revision from Git's C-locale completion message. */
export function parseBisectCompletion(output: string): string | undefined {
	return BISECT_COMPLETION.exec(output)?.[1];
}

/** Distinguish a normal bisect advance from unparseable completion or no progress. */
export function determineBisectProgress(
	beforeRevision: string,
	afterRevision: string,
	output: string
): string | undefined {
	const revision = parseBisectCompletion(output);
	if (BISECT_COMPLETION.test(output)) {
		if (!revision) throw new Error(`Could not parse Git bisect completion:\n${output}`);
		return revision;
	}
	if (beforeRevision === afterRevision) {
		throw new Error(`Could not determine Git bisect progress:\n${output}`);
	}
	return undefined;
}

/** Discover public Astro workspace packages without a glob dependency. */
export async function discoverAstroWorkspacePackages(
	repositoryRoot: string
): Promise<Map<string, string>> {
	const manifests = new Map<string, string>();
	await walkPackageManifests(repositoryRoot, manifests);
	return manifests;
}

/**
 * Select local packages that must accompany the installed graph, including
 * workspace-protocol edges introduced by the checked-out revision.
 */
export async function collectAstroWorkspacePackageClosure(
	packages: ReadonlyMap<string, string>,
	installedNames: ReadonlySet<string>
): Promise<Map<string, string>> {
	const selected = new Map<string, string>();
	const pending = [...installedNames];
	while (pending.length > 0) {
		const name = pending.pop()!;
		const packageRoot = packages.get(name);
		if (!packageRoot || selected.has(name)) continue;
		selected.set(name, packageRoot);
		const manifest = await readManifest(join(packageRoot, 'package.json'));
		for (const dependencies of [
			manifest.dependencies,
			manifest.optionalDependencies,
			manifest.peerDependencies,
		]) {
			for (const [dependency, descriptor] of Object.entries(dependencies ?? {})) {
				if (descriptor.startsWith('workspace:') && packages.has(dependency)) {
					pending.push(dependency);
				}
			}
		}
	}
	return selected;
}

export function abortError(signal: AbortSignal): Error {
	const error = new Error(
		signal.reason ? `Operation aborted: ${String(signal.reason)}` : 'Operation aborted'
	);
	error.name = 'AbortError';
	return error;
}

async function isYarnBerry(projectRoot: string, managerRoot: string): Promise<boolean> {
	let directory = resolve(projectRoot);
	while (true) {
		if (existsSync(join(directory, '.yarnrc.yml'))) return true;
		const manager = (await existingManifest(join(directory, 'package.json')))?.packageManager;
		const version = manager?.match(/^yarn@(\d+)/)?.[1];
		if (version !== undefined && Number(version) >= 2) return true;
		if (directory === managerRoot) return false;
		directory = dirname(directory);
	}
}

type FileSnapshot = {
	exists: boolean;
	content: Buffer;
};

async function snapshotFile(path: string): Promise<FileSnapshot> {
	try {
		return { exists: true, content: await readFile(path) };
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT')
			return { exists: false, content: Buffer.alloc(0) };
		throw error;
	}
}

async function restoreFile(path: string, snapshot: FileSnapshot): Promise<void> {
	if (snapshot.exists) {
		await writeFile(path, snapshot.content);
	} else {
		await rm(path, { force: true });
	}
}

function managerLockfile(manager: PackageManager, projectRoot: string): string {
	switch (manager) {
		case 'pnpm':
			return join(projectRoot, 'pnpm-lock.yaml');
		case 'yarn':
			return join(projectRoot, 'yarn.lock');
		case 'bun':
			return join(
				projectRoot,
				existsSync(join(projectRoot, 'bun.lockb')) ? 'bun.lockb' : 'bun.lock'
			);
		case 'npm':
			return join(
				projectRoot,
				existsSync(join(projectRoot, 'npm-shrinkwrap.json'))
					? 'npm-shrinkwrap.json'
					: 'package-lock.json'
			);
	}
}

type PackageLink = {
	name: string;
	path: string;
};

type PackageLinkCommand = {
	command: string[];
	cwd: string;
};

export function packageLinkCommands(
	manager: PackageManager,
	yarnBerry: boolean,
	projectRoot: string,
	links: readonly PackageLink[]
): PackageLinkCommand[] {
	switch (manager) {
		case 'npm':
			return [
				{
					command: [
						'npm',
						'install',
						'--no-save',
						'--package-lock=false',
						...links.map(({ path }) => path),
					],
					cwd: projectRoot,
				},
			];
		case 'bun':
			return [];
		case 'yarn':
			return [
				{
					command: [
						'yarn',
						'add',
						...(!yarnBerry ? ['--pure-lockfile', '--ignore-workspace-root-check'] : []),
						...links.map(({ name, path }) => `${name}@file:${path}`),
					],
					cwd: projectRoot,
				},
			];
		case 'pnpm':
			return links.map(({ path }) => ({
				command: ['pnpm', 'link', path],
				cwd: projectRoot,
			}));
	}
}

async function installedNodeModulesPackagePath(
	projectRoot: string,
	packageName: string
): Promise<string | undefined> {
	const requireFrom = createRequire(join(projectRoot, 'package.json'));
	for (const nodeModules of requireFrom.resolve.paths(packageName) ?? []) {
		const packagePath = join(nodeModules, packageName);
		if (await manifestAt(join(packagePath, 'package.json'), packageName)) return packagePath;
	}
	return undefined;
}

/** Replace a Bun-installed package with a local package without invoking Bun's registry linker. */
export async function linkBunPackage(projectRoot: string, link: PackageLink): Promise<string> {
	const packagePath =
		(await installedNodeModulesPackagePath(projectRoot, link.name)) ??
		join(projectRoot, 'node_modules', link.name);
	await rm(packagePath, { recursive: true, force: true });
	await mkdir(dirname(packagePath), { recursive: true });
	await symlink(link.path, packagePath, process.platform === 'win32' ? 'junction' : 'dir');
	return packagePath;
}

/** Remove consumer Node loader hooks from commands that run in the cloned repository. */
export function isolatedBootstrapEnvironment(
	environment: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
	const isolatedEnvironment = { ...environment };
	const nodeOptions = isolatedEnvironment.NODE_OPTIONS;
	if (nodeOptions === undefined) return isolatedEnvironment;

	const options = nodeOptions.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
	const loaderOptions: Record<string, true> = {
		'--require': true,
		'-r': true,
		'--import': true,
		'--loader': true,
		'--experimental-loader': true,
	};
	const retainedOptions: string[] = [];
	for (let index = 0; index < options.length; index += 1) {
		const option = options[index]!;
		const outerQuote = option.at(0);
		const normalizedOption =
			(outerQuote === '"' || outerQuote === "'") && option.at(-1) === outerQuote
				? option.slice(1, -1)
				: option;
		const [name] = normalizedOption.split('=', 1);
		const loaderName = name.replaceAll('_', '-');
		if (!(loaderName in loaderOptions)) {
			retainedOptions.push(option);
			continue;
		}
		if (name === normalizedOption) index += 1;
	}
	if (retainedOptions.length > 0) {
		isolatedEnvironment.NODE_OPTIONS = retainedOptions.join(' ');
	} else {
		delete isolatedEnvironment.NODE_OPTIONS;
	}
	return isolatedEnvironment;
}

export type DependencySymlinkSnapshot = {
	path: string;
	target: string;
	type: 'dir' | 'junction';
};

export function dependencySymlinkType(platform = process.platform): 'dir' | 'junction' {
	return platform === 'win32' ? 'junction' : 'dir';
}

/** Restore a dependency link exactly as it was before the bisect session. */
export async function restoreDependencySymlink(snapshot: DependencySymlinkSnapshot): Promise<void> {
	await rm(snapshot.path, { recursive: true, force: true });
	await mkdir(dirname(snapshot.path), { recursive: true });
	await symlink(snapshot.target, snapshot.path, snapshot.type);
}

async function snapshotDependencySymlinks(
	projectRoot: string,
	managerRoot: string,
	packageNames: ReadonlySet<string>
): Promise<DependencySymlinkSnapshot[]> {
	const requireFrom = createRequire(join(projectRoot, 'package.json'));
	const snapshots = new Map<string, DependencySymlinkSnapshot>();
	for (const packageName of packageNames) {
		for (const nodeModules of requireFrom.resolve.paths(packageName) ?? []) {
			const packagePath = join(nodeModules, packageName);
			const relativePath = relative(managerRoot, packagePath);
			if (relativePath.startsWith('..') || isAbsolute(relativePath)) continue;
			try {
				if (!(await lstat(packagePath)).isSymbolicLink()) continue;
				snapshots.set(packagePath, {
					path: packagePath,
					target: await readlink(packagePath),
					type: dependencySymlinkType(),
				});
			} catch (error: unknown) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			}
		}
	}
	return [...snapshots.values()];
}

const childTerminations = new WeakMap<ChildProcess, Promise<void>>();
const TASKKILL_EXIT_OBSERVATION_TIMEOUT = 100;

function childHasExited(child: ChildProcess): boolean {
	return child.exitCode !== null || child.signalCode !== null;
}

async function observeChildExit(child: ChildProcess): Promise<void> {
	if (childHasExited(child)) return;
	await new Promise<void>((resolve) => {
		let timeout: NodeJS.Timeout | undefined;
		const finish = () => {
			clearTimeout(timeout);
			child.removeListener('exit', finish);
			child.removeListener('close', finish);
			resolve();
		};
		child.once('exit', finish);
		child.once('close', finish);
		timeout = setTimeout(finish, TASKKILL_EXIT_OBSERVATION_TIMEOUT);
	});
}

type TaskkillLauncher = (pid: number) => ChildProcess;

const launchTaskkill: TaskkillLauncher = (pid) =>
	spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });

export function terminateChildProcess(
	child: ChildProcess | undefined,
	platform = process.platform,
	gracePeriod = 5_000,
	taskkillLauncher: TaskkillLauncher = launchTaskkill
): Promise<void> {
	if (!child) return Promise.resolve();
	const termination = childTerminations.get(child);
	if (termination) return termination;
	if (platform === 'win32' && childHasExited(child)) {
		const stopped = Promise.resolve();
		childTerminations.set(child, stopped);
		return stopped;
	}
	const pid = child.pid;
	if (!pid) return Promise.resolve();

	const promise = (async () => {
		if (platform === 'win32') {
			const taskkill = taskkillLauncher(pid);
			const exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
				taskkill.once('error', rejectExit);
				taskkill.once('close', resolveExit);
			});
			if (exitCode !== 0 && !childHasExited(child)) {
				await observeChildExit(child);
				if (!childHasExited(child)) {
					throw new Error(
						`taskkill failed while terminating process ${pid} (exit code ${exitCode})`
					);
				}
			}
			return;
		}

		const processGroupAlive = (): boolean => {
			try {
				process.kill(-pid, 0);
				return true;
			} catch (error: unknown) {
				return (error as NodeJS.ErrnoException).code !== 'ESRCH';
			}
		};
		const signalProcessGroup = (signal: NodeJS.Signals): void => {
			try {
				process.kill(-pid, signal);
			} catch {
				try {
					child.kill(signal);
				} catch {
					// The process may have already exited.
				}
			}
		};
		const waitForGroupExit = async (): Promise<boolean> => {
			const deadline = Date.now() + gracePeriod;
			while (processGroupAlive()) {
				if (Date.now() >= deadline) return false;
				await delay(Math.min(50, deadline - Date.now()));
			}
			return true;
		};

		signalProcessGroup('SIGTERM');
		if (await waitForGroupExit()) return;
		signalProcessGroup('SIGKILL');
		if (!(await waitForGroupExit())) {
			throw new Error(`Process group ${pid} remained alive after SIGKILL`);
		}
	})();
	childTerminations.set(child, promise);
	void promise.catch(() => {
		if (childTerminations.get(child) === promise) childTerminations.delete(child);
	});
	return promise;
}

type ChildTerminator = (child: ChildProcess | undefined) => Promise<void>;
type CommandSpawner = (
	file: string,
	args: string[],
	options: NonNullable<Parameters<typeof spawn>[2]>
) => ChildProcess | Promise<ChildProcess>;

export class RuntimeSession implements BisectSession {
	private activeChild: ChildProcess | undefined;
	private bisectActive = false;
	private readonly bunLinkTargets = new Map<string, string>();
	private readonly linkedPackages = new Map<string, string>();
	private closing: Promise<void> | undefined;

	public constructor(
		private readonly projectRoot: string,
		private readonly managerRoot: string,
		private readonly repositoryRoot: string,
		private readonly temporaryRoot: string,
		private readonly isolatedCorepackCli: string,
		private readonly manager: PackageManager,
		private readonly yarnBerry: boolean,
		private readonly originalManagerManifest: FileSnapshot,
		private readonly originalProjectManifest: FileSnapshot,
		private readonly managerLockPath: string,
		private readonly originalManagerLock: FileSnapshot,
		private readonly originalDependencySymlinks: readonly DependencySymlinkSnapshot[],
		private readonly installedDependencies: ReadonlySet<string>,
		private readonly latest: string,
		private readonly signal: AbortSignal,
		private readonly terminate: ChildTerminator = terminateChildProcess,
		private readonly commandSpawner?: CommandSpawner
	) {}

	public async latestRevision(): Promise<string> {
		return this.latest;
	}

	private async stopChild(child = this.activeChild): Promise<void> {
		await this.terminate(child);
	}

	private async launchCommand(
		file: string,
		args: string[],
		options: NonNullable<Parameters<typeof spawn>[2]>
	): Promise<ChildProcess> {
		return this.commandSpawner
			? this.commandSpawner(file, args, options)
			: this.spawnCommand(file, args, options);
	}

	private async spawnCommand(
		file: string,
		args: string[],
		options: NonNullable<Parameters<typeof spawn>[2]>
	): Promise<ChildProcess> {
		if (process.platform !== 'win32') return spawn(file, args, options);

		const controlFile = join(this.temporaryRoot, `command-${randomUUID()}.json`);
		await writeFile(controlFile, JSON.stringify({ file, args }));
		let child: ChildProcess;
		try {
			const [supervisor, ...supervisorArgs] = windowsJobSupervisorCommand(controlFile);
			child = spawn(supervisor, supervisorArgs, options);
		} catch (error) {
			await rm(controlFile, { force: true });
			throw error;
		}
		const cleanControlFile = () => void rm(controlFile, { force: true }).catch(() => undefined);
		child.once('error', cleanControlFile);
		child.once('close', cleanControlFile);
		return child;
	}

	public async execute(
		command: readonly string[],
		cwd: string,
		options: CommandOptions = {}
	): Promise<string> {
		if (this.signal.aborted && !options.ignoreAbort) throw abortError(this.signal);
		const [file, ...args] = command;
		if (!file) throw new Error('Cannot run an empty command');

		let child: ChildProcess;
		try {
			child = await this.launchCommand(file, args, {
				cwd,
				env: options.env,
				stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
				detached: process.platform !== 'win32',
			});
		} catch (error) {
			throw new Error(`Could not start ${commandText(command)} in ${cwd}: ${String(error)}`);
		}
		this.activeChild = child;
		let output = '';
		if (options.capture) {
			child.stdout?.on('data', (chunk: Buffer) => {
				output += chunk.toString();
			});
			child.stderr?.on('data', (chunk: Buffer) => {
				output += chunk.toString();
			});
		}

		let exitCode: number | null;
		let terminationFailed = false;
		try {
			exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
				let abortTermination: Promise<void> | undefined;
				const abort = () => {
					abortTermination = this.stopChild(child);
					void abortTermination.catch((error: unknown) => {
						terminationFailed = true;
						rejectExit(error);
					});
				};
				if (!options.ignoreAbort) {
					if (this.signal.aborted) abort();
					else this.signal.addEventListener('abort', abort, { once: true });
				}
				child.once('error', (error) => {
					if (!options.ignoreAbort) this.signal.removeEventListener('abort', abort);
					rejectExit(
						new Error(`Could not run ${commandText(command)} in ${cwd}: ${String(error)}`)
					);
				});
				child.once('close', (code) => {
					if (!options.ignoreAbort) this.signal.removeEventListener('abort', abort);
					if (abortTermination) {
						void abortTermination.then(
							() => resolveExit(code),
							(error: unknown) => {
								terminationFailed = true;
								rejectExit(error);
							}
						);
					} else {
						resolveExit(code);
					}
				});
			});
		} finally {
			if (!terminationFailed && this.activeChild === child) this.activeChild = undefined;
		}
		if (this.signal.aborted && !options.ignoreAbort) throw abortError(this.signal);
		if (exitCode !== 0) {
			throw new CommandError(command, cwd, exitCode, output);
		}
		return output;
	}

	private async materializePackages(
		packages: ReadonlyMap<string, string>
	): Promise<Map<string, string>> {
		const destinationRoot = join(this.temporaryRoot, 'packages');
		await rm(destinationRoot, { recursive: true, force: true });
		await mkdir(destinationRoot, { recursive: true });

		const archives = new Map<string, string>();
		for (const [name, packageRoot] of packages) {
			const destination = join(destinationRoot, Buffer.from(name).toString('hex'));
			await this.execute(
				[
					process.execPath,
					this.isolatedCorepackCli,
					'pnpm',
					'pack',
					'--pack-destination',
					destination,
				],
				packageRoot,
				{ env: isolatedBootstrapEnvironment() }
			);
			const archivesInDestination = (await readdir(destination))
				.filter((entry) => entry.endsWith('.tgz'))
				.map((entry) => join(destination, entry));
			if (archivesInDestination.length !== 1) {
				throw new Error(`Could not materialize exactly one package archive for ${name}`);
			}
			archives.set(name, archivesInDestination[0]!);
		}
		return archives;
	}

	private async addYarnResolutions(links: readonly PackageLink[]): Promise<void> {
		const manifestPath = join(this.managerRoot, 'package.json');
		const manifest = await readManifest(manifestPath);
		manifest.resolutions = {
			...manifest.resolutions,
			...Object.fromEntries(links.map(({ name, path }) => [name, `file:${path}`])),
		};
		await writeFile(manifestPath, `${JSON.stringify(manifest, undefined, '\t')}\n`);
	}

	private async linkPackages(packages: ReadonlyMap<string, string>): Promise<void> {
		const sourceLinks = [
			...(await collectAstroWorkspacePackageClosure(packages, this.installedDependencies)),
		].map(([name, path]) => ({ name, path }));
		if (!sourceLinks.some(({ name }) => name === 'astro')) {
			throw new Error(
				'Astro is not available in both the installed dependencies and this revision'
			);
		}

		if (this.manager === 'bun') {
			for (const link of sourceLinks) {
				this.bunLinkTargets.set(link.name, await linkBunPackage(this.projectRoot, link));
				this.linkedPackages.set(link.name, link.path);
			}
			return;
		}

		let links: PackageLink[];
		if (this.manager === 'pnpm') {
			links = sourceLinks;
		} else {
			const archives = await this.materializePackages(
				new Map(sourceLinks.map(({ name, path }) => [name, path]))
			);
			links = sourceLinks.map(({ name }) => ({ name, path: archives.get(name)! }));
		}
		if (this.manager === 'yarn') await this.addYarnResolutions(links);
		for (const { name, path } of links) this.linkedPackages.set(name, path);
		for (const { command, cwd } of packageLinkCommands(
			this.manager,
			this.yarnBerry,
			this.projectRoot,
			links
		)) {
			await this.execute(command, cwd);
		}
	}

	private async restorePreviousLinks(): Promise<void> {
		if (this.linkedPackages.size === 0) return;

		const failures: unknown[] = [];
		try {
			await this.unlinkPackages();
		} catch (error) {
			failures.push(error);
		}
		try {
			await this.restoreDependencies();
			this.linkedPackages.clear();
		} catch (error) {
			failures.push(error);
		}

		if (failures.length > 0) {
			throw new AggregateError(failures, 'Could not restore dependencies between revisions');
		}
	}

	public async prepareRevision(revision: string): Promise<void> {
		await this.restorePreviousLinks();
		await this.execute(['git', 'checkout', '--force', revision], this.repositoryRoot);
		await this.execute(['git', 'clean', '-fdx'], this.repositoryRoot);
		await this.execute(
			[process.execPath, this.isolatedCorepackCli, 'pnpm', 'install', '--frozen-lockfile'],
			this.repositoryRoot,
			{ env: isolatedBootstrapEnvironment() }
		);
		await this.execute(
			[process.execPath, this.isolatedCorepackCli, 'pnpm', 'run', 'build'],
			this.repositoryRoot,
			{ env: isolatedBootstrapEnvironment() }
		);
		await this.linkPackages(await discoverAstroWorkspacePackages(this.repositoryRoot));
	}

	private async prompt(label: string, signal: AbortSignal): Promise<boolean> {
		const readline = createInterface({ input: process.stdin, output: process.stdout });
		try {
			while (true) {
				const response = (
					await readline.question(`${label}: is the bug present? [y/n] `, { signal })
				)
					.trim()
					.toLowerCase();
				if (response === 'y' || response === 'yes') return true;
				if (response === 'n' || response === 'no') return false;
				console.error('Please answer y or n.');
			}
		} finally {
			readline.close();
		}
	}

	public async runDevServerAndAsk(label: string): Promise<boolean> {
		const child = await this.launchCommand(this.manager, ['run', 'dev'], {
			cwd: this.projectRoot,
			stdio: developmentServerStdio,
			detached: process.platform !== 'win32',
		});
		this.activeChild = child;
		const promptController = new AbortController();
		const earlyExit = new Promise<never>((_, reject) => {
			child.once('error', (error) =>
				reject(
					new Error(
						`Could not start ${this.manager} run dev in ${this.projectRoot}: ${String(error)}`
					)
				)
			);
			child.once('exit', (code) =>
				reject(new CommandError([this.manager, 'run', 'dev'], this.projectRoot, code, ''))
			);
		});
		let promptWork: Promise<boolean> | undefined;
		try {
			await Promise.race([delay(100, undefined, { signal: this.signal }), earlyExit]);
			promptWork = this.prompt(label, AbortSignal.any([this.signal, promptController.signal]));
			return await Promise.race([promptWork, earlyExit]);
		} finally {
			promptController.abort('The development server exited before the prompt completed.');
			await promptWork?.catch(() => undefined);
			await this.stopChild(child);
			if (this.activeChild === child) this.activeChild = undefined;
		}
	}

	public async startBisect(good: string, bad: string): Promise<void> {
		await this.execute(['git', 'bisect', 'start', bad, good], this.repositoryRoot, {
			env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
		});
		this.bisectActive = true;
	}

	public async currentRevision(): Promise<string> {
		return (
			await this.execute(['git', 'rev-parse', 'HEAD'], this.repositoryRoot, { capture: true })
		).trim();
	}

	public async markCurrent(isBad: boolean): Promise<string | undefined> {
		const environment = { ...process.env, LC_ALL: 'C', LANG: 'C' };
		const beforeRevision = (
			await this.execute(['git', 'rev-parse', 'HEAD'], this.repositoryRoot, {
				capture: true,
				env: environment,
			})
		).trim();
		const output = await this.execute(
			['git', 'bisect', isBad ? 'bad' : 'good'],
			this.repositoryRoot,
			{ capture: true, env: environment }
		);
		const afterRevision = (
			await this.execute(['git', 'rev-parse', 'HEAD'], this.repositoryRoot, {
				capture: true,
				env: environment,
			})
		).trim();
		const revision = determineBisectProgress(beforeRevision, afterRevision, output);
		if (!revision) return undefined;
		return (
			await this.execute(['git', 'rev-parse', `${revision}^{commit}`], this.repositoryRoot, {
				capture: true,
				env: environment,
			})
		).trim();
	}

	private async unlinkPackages(): Promise<void> {
		const failures: unknown[] = [];
		const remove = async (path: string): Promise<void> => {
			try {
				await rm(path, { recursive: true, force: true });
			} catch (error) {
				failures.push(error);
			}
		};
		const unlink = async (command: string[], cwd: string): Promise<void> => {
			try {
				await this.execute(command, cwd, { ignoreAbort: true });
			} catch (error) {
				failures.push(error);
			}
		};
		for (const [name, path] of this.linkedPackages) {
			switch (this.manager) {
				case 'npm':
					break;
				case 'bun': {
					const target = this.bunLinkTargets.get(name);
					if (target) await remove(target);
					break;
				}
				case 'yarn':
					break;
				case 'pnpm':
					await unlink(['pnpm', 'unlink', name], this.projectRoot);
			}
		}
		this.bunLinkTargets.clear();
		if (failures.length > 0) {
			throw new AggregateError(failures, 'Could not unlink all Astro packages');
		}
		this.linkedPackages.clear();
	}

	private async restoreDependencies(): Promise<void> {
		const failures: unknown[] = [];
		const restore = async (operation: () => Promise<unknown>): Promise<void> => {
			try {
				await operation();
			} catch (error) {
				failures.push(error);
			}
		};
		await restore(() =>
			restoreFile(join(this.managerRoot, 'package.json'), this.originalManagerManifest)
		);
		if (this.projectRoot !== this.managerRoot) {
			await restore(() =>
				restoreFile(join(this.projectRoot, 'package.json'), this.originalProjectManifest)
			);
		}
		await restore(() => restoreFile(this.managerLockPath, this.originalManagerLock));
		switch (this.manager) {
			case 'pnpm':
				await restore(() =>
					this.execute(['pnpm', 'install', '--frozen-lockfile'], this.managerRoot, {
						ignoreAbort: true,
					})
				);
				break;
			case 'yarn':
				await restore(() =>
					this.execute(
						[
							'yarn',
							'install',
							this.yarnBerry ? '--immutable' : '--frozen-lockfile',
							...(!this.yarnBerry ? ['--force'] : []),
						],
						this.managerRoot,
						{ ignoreAbort: true }
					)
				);
				break;
			case 'bun':
				await restore(() =>
					this.execute(['bun', 'install', '--frozen-lockfile', '--force'], this.managerRoot, {
						ignoreAbort: true,
					})
				);
				break;
			case 'npm':
				await restore(() => this.execute(['npm', 'ci'], this.managerRoot, { ignoreAbort: true }));
		}
		await restore(() => restoreFile(this.managerLockPath, this.originalManagerLock));
		for (const snapshot of this.originalDependencySymlinks) {
			await restore(() => restoreDependencySymlink(snapshot));
		}
		if (failures.length > 0) {
			throw new AggregateError(failures, 'Could not fully restore project dependencies');
		}
	}
	public async close(): Promise<void> {
		if (this.closing) return this.closing;
		this.closing = (async () => {
			const failures: unknown[] = [];
			const cleanup = async (operation: () => Promise<unknown>): Promise<void> => {
				try {
					await operation();
				} catch (error) {
					failures.push(error);
				}
			};
			await cleanup(() => this.stopChild());
			await cleanup(() => this.unlinkPackages());
			await cleanup(() => this.restoreDependencies());
			if (this.bisectActive) {
				await cleanup(() =>
					this.execute(['git', 'bisect', 'reset'], this.repositoryRoot, { ignoreAbort: true })
				);
			}
			await cleanup(() => rm(this.temporaryRoot, { recursive: true, force: true }));
			if (failures.length > 0) {
				throw new AggregateError(failures, 'every-astro cleanup failed');
			}
		})();
		return this.closing;
	}
}

async function copyCorepackCli(temporaryRoot: string): Promise<string> {
	const isolatedPackage = join(temporaryRoot, 'node_modules', 'corepack');
	const isolatedDist = join(isolatedPackage, 'dist');
	const isolatedCli = join(isolatedDist, 'corepack.js');
	await mkdir(join(isolatedDist, 'lib'), { recursive: true });
	await Promise.all([
		writeFile(
			join(isolatedPackage, 'package.json'),
			await readFile(join(dirname(dirname(corepackCli)), 'package.json'))
		),
		writeFile(isolatedCli, await readFile(corepackCli)),
		writeFile(
			join(isolatedDist, 'lib', 'corepack.cjs'),
			await readFile(join(dirname(corepackCli), 'lib', 'corepack.cjs'))
		),
	]);
	return isolatedCli;
}

export function selectLatestAstroReleaseTag(tags: readonly string[], major: number): string {
	const releases: { tag: string; minor: number; patch: number }[] = [];
	for (const tag of tags) {
		const match = /^astro@(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
		if (!match || Number(match[1]) !== major) continue;
		releases.push({
			tag: tag.trim(),
			minor: Number(match[2]),
			patch: Number(match[3]),
		});
	}
	releases.sort(
		(first, second) =>
			second.minor - first.minor ||
			second.patch - first.patch ||
			first.tag.localeCompare(second.tag)
	);
	const latest = releases[0];
	if (!latest) {
		throw new Error(`Could not find a stable Astro ${major} release tag in the cloned repository`);
	}
	return latest.tag;
}

export function assertFirstAstroReleaseTag(tags: readonly string[], major: number): void {
	const firstRelease = `astro@${major}.0.0`;
	if (!tags.some((tag) => tag.trim() === firstRelease)) {
		throw new Error(
			`Astro ${major} has no stable first-release bisect boundary (${firstRelease}) in the cloned repository`
		);
	}
}

/** Git revision expression that resolves a release tag to the commit that bisect needs. */
export function selectLatestAstroReleaseRevision(tags: readonly string[], major: number): string {
	return `${selectLatestAstroReleaseTag(tags, major)}^{commit}`;
}

export function selectLatestAstroRevision(
	tags: readonly string[],
	major: number,
	headAstroVersion: string | undefined
): string {
	return astroMajorFromVersion(headAstroVersion) === major
		? 'HEAD'
		: selectLatestAstroReleaseRevision(tags, major);
}

async function createRuntimeSession(
	projectRoot: string,
	managerInfo: DetectedPackageManager,
	installedDependencies: ReadonlySet<string>,
	installedAstroMajor: number,
	signal: AbortSignal
): Promise<RuntimeSession> {
	const managerRoot = managerInfo.root;
	const managerLockPath = managerLockfile(managerInfo.manager, managerRoot);
	const [
		yarnBerry,
		originalManagerManifest,
		originalProjectManifest,
		originalManagerLock,
		originalDependencySymlinks,
	] = await Promise.all([
		isYarnBerry(projectRoot, managerRoot),
		snapshotFile(join(managerRoot, 'package.json')),
		snapshotFile(join(projectRoot, 'package.json')),
		snapshotFile(managerLockPath),
		snapshotDependencySymlinks(projectRoot, managerRoot, installedDependencies),
	]);
	if (!originalManagerLock.exists) {
		throw new Error(
			`every-astro requires a ${managerInfo.manager} lockfile to restore the exact dependency tree`
		);
	}
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'every-astro-'));
	const repositoryRoot = join(temporaryRoot, 'astro');
	try {
		const isolatedCorepackCli = await copyCorepackCli(temporaryRoot);
		const bootstrap = new RuntimeSession(
			projectRoot,
			managerRoot,
			repositoryRoot,
			temporaryRoot,
			isolatedCorepackCli,
			managerInfo.manager,
			yarnBerry,
			originalManagerManifest,
			originalProjectManifest,
			managerLockPath,
			originalManagerLock,
			originalDependencySymlinks,
			new Set(),
			'',
			signal
		);
		await bootstrap.execute(['git', 'clone', ASTRO_REPOSITORY, repositoryRoot], temporaryRoot);
		const tags = await bootstrap.execute(['git', 'tag', '--list'], repositoryRoot, {
			capture: true,
		});
		const tagList = tags.split(/\r?\n/);
		assertFirstAstroReleaseTag(tagList, installedAstroMajor);
		const headManifest = await existingManifest(
			join(repositoryRoot, 'packages', 'astro', 'package.json')
		);
		const latestRevision = selectLatestAstroRevision(
			tagList,
			installedAstroMajor,
			headManifest?.version
		);
		const latest = await bootstrap.execute(['git', 'rev-parse', latestRevision], repositoryRoot, {
			capture: true,
		});
		const session = new RuntimeSession(
			projectRoot,
			managerRoot,
			repositoryRoot,
			temporaryRoot,
			isolatedCorepackCli,
			managerInfo.manager,
			yarnBerry,
			originalManagerManifest,
			originalProjectManifest,
			managerLockPath,
			originalManagerLock,
			originalDependencySymlinks,
			installedDependencies,
			latest.trim(),
			signal
		);
		return session;
	} catch (error) {
		try {
			await rm(temporaryRoot, { recursive: true, force: true });
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				'Could not create every-astro runtime session and remove its temporary directory',
				{ cause: error }
			);
		}
		throw error;
	}
}

/** Build the runtime implementation consumed by the pure workflow. */
export async function createRuntimeDependencies(
	projectRoot: string,
	signal: AbortSignal
): Promise<EveryAstroDependencies> {
	const absoluteProjectRoot = resolve(projectRoot);
	const [managerInfo, major, installedDependencies] = await Promise.all([
		detectPackageManagerInfo(absoluteProjectRoot),
		installedAstroMajor(absoluteProjectRoot),
		collectInstalledDependencyNames(absoluteProjectRoot),
	]);
	let session: Promise<RuntimeSession> | undefined;
	return {
		signal,
		installedAstroMajor: () => Promise.resolve(major),
		createSession: () => {
			session ??= createRuntimeSession(
				absoluteProjectRoot,
				managerInfo,
				installedDependencies,
				major,
				signal
			);
			return session;
		},
		log: (message) => console.log(message),
	};
}
