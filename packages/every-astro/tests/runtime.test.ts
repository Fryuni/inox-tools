import { type ChildProcess, spawn as spawnChild } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { createRequire } from 'node:module';
import {
	appendFile,
	mkdir,
	lstat,
	mkdtemp,
	readFile,
	readlink,
	readdir,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	abortError,
	assertFirstAstroReleaseTag,
	collectInstalledDependencyNames,
	collectAstroWorkspacePackageClosure,
	createRuntimeDependencies,
	determineBisectProgress,
	developmentServerStdio,
	detectPackageManager,
	detectPackageManagerRoot,
	discoverAstroWorkspacePackages,
	installedAstroMajor,
	isolatedBootstrapEnvironment,
	windowsJobSupervisorCommand,
	windowsBatchCommandTail,
	linkBunPackage,
	packageLinkCommands,
	parseBisectCompletion,
	RuntimeSession,
	resolveInstalledPackageManifest,
	restoreDependencySymlink,
	snapshotDependencySymlinks,
	selectLatestAstroReleaseTag,
	selectLatestAstroReleaseRevision,
	selectLatestAstroRevision,
	terminateChildProcess,
} from '../src/runtime.js';

const temporaryRoots: string[] = [];
type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm';

const spawnCross = createRequire(import.meta.url)('cross-spawn') as typeof spawnChild;

async function temporaryRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'every-astro-test-'));
	temporaryRoots.push(root);
	return root;
}

async function writeJson(path: string, value: unknown): Promise<void> {
	await mkdir(join(path, '..'), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, '\t')}\n`);
}

async function createProject(manifest: Record<string, unknown> = {}): Promise<string> {
	const root = await temporaryRoot();
	await writeJson(join(root, 'package.json'), { name: 'test-project', ...manifest });
	return root;
}

async function createPnpArchiveProject(): Promise<string> {
	const project = await createProject({ dependencies: { astro: '7.0.0' } });
	const packageRoot = join(project, '.yarn/cache/astro.zip/node_modules/astro');
	await mkdir(join(project, '.yarn/cache'), { recursive: true });
	await writeFile(join(project, '.yarn/cache/astro.zip'), '');
	await writeFile(
		join(project, '.pnp.cjs'),
		`exports.resolveToUnqualified = (request) => request === 'astro' ? ${JSON.stringify(packageRoot)} : null;\n`
	);
	return project;
}

async function writePackage(
	root: string,
	directory: string,
	manifest: Record<string, unknown>
): Promise<void> {
	await writeJson(join(root, directory, 'package.json'), manifest);
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	environment: NodeJS.ProcessEnv = {}
): Promise<string> {
	const child = spawnCross(command, args, {
		cwd,
		env: { ...process.env, ...environment },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let output = '';
	child.stdout.on('data', (chunk: Buffer) => {
		output += chunk;
	});
	child.stderr.on('data', (chunk: Buffer) => {
		output += chunk;
	});
	const [exitCode] = (await once(child, 'close')) as [number | null];
	if (exitCode !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${output}`);
	return output;
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('installedAstroMajor', () => {
	test('reads the major version from the Astro package resolved by the project', async () => {
		const project = await createProject({ dependencies: { astro: '^7.2.1' } });
		await writePackage(project, 'node_modules/astro', { name: 'astro', version: '7.2.1' });

		await expect(installedAstroMajor(project)).resolves.toBe(7);
	});
});

test.each([
	['successful manifest', 'success'],
	['nonzero exit', 'failure'],
	['malformed manifest', 'malformed'],
])('reaps a pipe-inheriting PnP reader descendant after a %s', async (_name, mode) => {
	const project = await createProject({
		packageManager: 'yarn@4.17.1',
		dependencies: { astro: '7.0.0' },
	});
	const pidDirectory = join(project, 'reader-pids');
	const packageRoot = join(project, '.yarn/cache/astro.zip/node_modules/astro');
	await mkdir(pidDirectory, { recursive: true });
	await mkdir(join(project, '.yarn/cache'), { recursive: true });
	await writeFile(join(project, '.yarn/cache/astro.zip'), '');
	await writeFile(
		join(project, '.pnp.cjs'),
		`exports.resolveToUnqualified = (request) => request === 'astro' ? ${JSON.stringify(packageRoot)} : null;\n`
	);
	await writeFile(
		join(project, '.yarnrc.yml'),
		'yarnPath: .yarn/releases/reader.cjs\nnodeLinker: pnp\n'
	);
	// The unrefed fixture child must outlive its launcher until reader cleanup owns it.
	await mkdir(join(project, '.yarn/releases'), { recursive: true });
	await writeFile(
		join(project, '.yarn/releases/reader.cjs'),
		[
			"const { spawn } = require('node:child_process');",
			"const { mkdirSync, writeFileSync } = require('node:fs');",
			"const { join } = require('node:path');",
			'const directory = process.env.EVERY_ASTRO_PNP_READER_PIDS;',
			"if (!directory) throw new Error('Missing PID directory');",
			'mkdirSync(directory, { recursive: true });',
			"const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { stdio: 'inherit' });",
			'descendant.unref();',
			"writeFileSync(join(directory, `reader-${process.pid}`), '');",
			"writeFileSync(join(directory, `descendant-${descendant.pid}`), '');",
			"process.stderr.write('reader stderr');",
			mode === 'success'
				? "process.stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));"
				: mode === 'malformed'
					? "process.stdout.write('not JSON');"
					: '',
			mode === 'failure' ? 'process.exit(1);' : 'process.exit(0);',
		].join('\n')
	);
	const previousPidDirectory = process.env.EVERY_ASTRO_PNP_READER_PIDS;
	process.env.EVERY_ASTRO_PNP_READER_PIDS = pidDirectory;
	try {
		if (mode === 'success') {
			await expect(installedAstroMajor(project)).resolves.toBe(7);
		} else if (mode === 'malformed') {
			await expect(installedAstroMajor(project)).rejects.toThrow(SyntaxError);
		} else {
			await expect(installedAstroMajor(project)).rejects.toThrow(
				/Could not read PnP manifest[\s\S]*reader stderr/
			);
		}
		const pids = (await readdir(pidDirectory))
			.map((entry) => Number(entry.slice(entry.lastIndexOf('-') + 1)))
			.filter(Number.isSafeInteger);
		expect(pids).toHaveLength(2);
		for (const pid of pids) {
			expect(() => process.kill(pid, 0)).toThrow(/ESRCH/);
		}
	} finally {
		if (previousPidDirectory === undefined) delete process.env.EVERY_ASTRO_PNP_READER_PIDS;
		else process.env.EVERY_ASTRO_PNP_READER_PIDS = previousPidDirectory;
	}
});

test('aborts a PnP reader launched after setup starts without caching its manifest', async () => {
	const project = await createProject({
		packageManager: 'yarn@4.17.1',
		dependencies: { astro: '7.0.0' },
	});
	const packageRoot = join(project, '.yarn/cache/astro.zip/node_modules/astro');
	await mkdir(join(project, '.yarn/cache'), { recursive: true });
	await writeFile(join(project, '.yarn/cache/astro.zip'), '');
	await writeFile(
		join(project, '.pnp.cjs'),
		`exports.resolveToUnqualified = (request) => request === 'astro' ? ${JSON.stringify(packageRoot)} : null;\n`
	);
	await writeFile(
		join(project, '.yarnrc.yml'),
		'yarnPath: .yarn/releases/reader.cjs\nnodeLinker: pnp\n'
	);
	await mkdir(join(project, '.yarn/releases'), { recursive: true });
	// The reader stays alive until setup-window abort handling terminates it.
	await writeFile(join(project, '.yarn/releases/reader.cjs'), 'setInterval(() => {}, 1_000);\n');
	const controller = new AbortController();
	let reader: ChildProcess | undefined;
	const delayedLaunch = async (
		_temporaryRoot: string,
		file: string,
		args: string[],
		options: NonNullable<Parameters<typeof spawnCross>[2]>
	): Promise<ChildProcess> => {
		controller.abort('during PnP reader setup');
		await Promise.resolve();
		reader = spawnCross(file, args, options);
		return reader;
	};
	try {
		await expect(
			resolveInstalledPackageManifest('astro', project, undefined, controller.signal, delayedLaunch)
		).rejects.toMatchObject({ name: 'AbortError' });
		expect(reader?.pid).toBeTypeOf('number');
		expect(() => process.kill(reader!.pid!, 0)).toThrow(/ESRCH/);

		await writeFile(
			join(project, '.yarn/releases/reader.cjs'),
			"process.stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));\n"
		);
		await expect(resolveInstalledPackageManifest('astro', project)).resolves.toBe(
			join(packageRoot, 'package.json')
		);
	} finally {
		await terminateChildProcess(reader);
	}
});

test('evicts a failed in-flight PnP manifest read before a successful retry', async () => {
	const project = await createPnpArchiveProject();
	let launches = 0;
	const failedLaunch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		launches += 1;
		const reader = Object.assign(new EventEmitter(), {
			stdout: new PassThrough(),
			stderr: new PassThrough(),
		}) as unknown as ChildProcess;
		observe?.(reader);
		process.nextTick(() => {
			reader.emit('exit', 1);
			reader.emit('close', 1);
		});
		return reader;
	};
	const successfulLaunch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		launches += 1;
		const stdout = new PassThrough();
		const reader = Object.assign(new EventEmitter(), {
			stdout,
			stderr: new PassThrough(),
		}) as unknown as ChildProcess;
		observe?.(reader);
		process.nextTick(() => {
			stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));
			reader.emit('exit', 0);
			reader.emit('close', 0);
		});
		return reader;
	};

	await expect(
		resolveInstalledPackageManifest('astro', project, undefined, undefined, failedLaunch)
	).rejects.toThrow('exit code 1');
	await expect(
		resolveInstalledPackageManifest('astro', project, undefined, undefined, successfulLaunch)
	).resolves.toMatch(/astro\.zip[\\/]node_modules[\\/]astro[\\/]package\.json$/);
	expect(launches).toBe(2);
});

test('evicts an aborted in-flight PnP manifest read before a successful retry', async () => {
	const project = await createPnpArchiveProject();
	const controller = new AbortController();
	const launched = Promise.withResolvers<void>();
	let launches = 0;
	const hangingLaunch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		launches += 1;
		const reader = Object.assign(new EventEmitter(), {
			stdout: new PassThrough(),
			stderr: new PassThrough(),
		}) as unknown as ChildProcess;
		observe?.(reader);
		launched.resolve();
		return reader;
	};
	const successfulLaunch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		launches += 1;
		const stdout = new PassThrough();
		const reader = Object.assign(new EventEmitter(), {
			stdout,
			stderr: new PassThrough(),
		}) as unknown as ChildProcess;
		observe?.(reader);
		process.nextTick(() => {
			stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));
			reader.emit('exit', 0);
			reader.emit('close', 0);
		});
		return reader;
	};
	const pending = resolveInstalledPackageManifest(
		'astro',
		project,
		undefined,
		controller.signal,
		hangingLaunch,
		async (reader) => {
			reader?.emit('close', null);
		}
	);
	await launched.promise;
	controller.abort('cancelled reader');

	await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
	await expect(
		resolveInstalledPackageManifest('astro', project, undefined, undefined, successfulLaunch)
	).resolves.toMatch(/astro\.zip[\\/]node_modules[\\/]astro[\\/]package\.json$/);
	expect(launches).toBe(2);
});

test('rejects a newly aborted caller even after its PnP manifest was cached', async () => {
	const project = await createPnpArchiveProject();
	const stdout = new PassThrough();
	const reader = Object.assign(new EventEmitter(), {
		stdout,
		stderr: new PassThrough(),
	}) as unknown as ChildProcess;
	const launch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		observe?.(reader);
		process.nextTick(() => {
			stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));
			reader.emit('exit', 0);
			reader.emit('close', 0);
		});
		return reader;
	};
	await expect(
		resolveInstalledPackageManifest('astro', project, undefined, undefined, launch)
	).resolves.toMatch(/astro\.zip[\\/]node_modules[\\/]astro[\\/]package\.json$/);

	const controller = new AbortController();
	const cached = resolveInstalledPackageManifest('astro', project, undefined, controller.signal);
	controller.abort('cached caller cancelled');
	await expect(cached).rejects.toMatchObject({ name: 'AbortError' });
});

test('does not attach an aborting handoff caller to a draining PnP generation', async () => {
	const project = await createPnpArchiveProject();
	const firstLaunched = Promise.withResolvers<void>();
	const cleanupStarted = Promise.withResolvers<void>();
	const cleanupRelease = Promise.withResolvers<void>();
	let launches = 0;
	let terminating = false;
	const launch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		launches += 1;
		const stdout = new PassThrough();
		const reader = Object.assign(new EventEmitter(), {
			stdout,
			stderr: new PassThrough(),
		}) as unknown as ChildProcess;
		observe?.(reader);
		if (launches === 1) {
			firstLaunched.resolve();
		} else {
			process.nextTick(() => {
				stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));
				reader.emit('exit', 0);
				reader.emit('close', 0);
			});
		}
		return reader;
	};
	const terminate = async (reader: ChildProcess | undefined): Promise<void> => {
		if (terminating) return;
		terminating = true;
		cleanupStarted.resolve();
		await cleanupRelease.promise;
		reader?.emit('close', null);
	};
	const firstController = new AbortController();
	const secondController = new AbortController();
	const first = resolveInstalledPackageManifest(
		'astro',
		project,
		undefined,
		firstController.signal,
		launch,
		terminate
	);
	void first.catch(() => undefined);
	const second = resolveInstalledPackageManifest(
		'astro',
		project,
		undefined,
		secondController.signal,
		launch,
		terminate
	);
	await firstLaunched.promise;
	void second.catch(() => undefined);
	firstController.abort('first caller cancelled');
	secondController.abort('second caller cancelled');
	await cleanupStarted.promise;

	const liveController = new AbortController();
	const live = resolveInstalledPackageManifest(
		'astro',
		project,
		undefined,
		liveController.signal,
		launch,
		terminate
	);
	void live.catch(() => undefined);
	await Promise.resolve();
	expect(launches).toBe(1);
	const liveResult = expect(live).rejects.toMatchObject({ name: 'AbortError' });
	liveController.abort('handoff caller cancelled');

	await liveResult;
	expect(launches).toBe(1);
	cleanupRelease.resolve();
	await expect(first).rejects.toMatchObject({ name: 'AbortError' });
	await expect(second).rejects.toMatchObject({ name: 'AbortError' });
	await expect(
		resolveInstalledPackageManifest('astro', project, undefined, undefined, launch, terminate)
	).resolves.toMatch(/astro\.zip[\\/]node_modules[\\/]astro[\\/]package\.json$/);
	expect(launches).toBe(2);
});

test.skipIf(process.platform === 'win32')(
	'aborts while successful PnP reader descendant cleanup is pending without caching',
	async () => {
		const project = await createProject({
			packageManager: 'yarn@4.17.1',
			dependencies: { astro: '7.0.0' },
		});
		const pidDirectory = join(project, 'reader-pids');
		const packageRoot = join(project, '.yarn/cache/astro.zip/node_modules/astro');
		await mkdir(pidDirectory, { recursive: true });
		await mkdir(join(project, '.yarn/cache'), { recursive: true });
		await writeFile(join(project, '.yarn/cache/astro.zip'), '');
		await writeFile(
			join(project, '.pnp.cjs'),
			`exports.resolveToUnqualified = (request) => request === 'astro' ? ${JSON.stringify(packageRoot)} : null;\n`
		);
		await writeFile(
			join(project, '.yarnrc.yml'),
			'yarnPath: .yarn/releases/reader.cjs\nnodeLinker: pnp\n'
		);
		await mkdir(join(project, '.yarn/releases'), { recursive: true });
		// The unrefed child deliberately survives its successful reader until cleanup owns it.
		await writeFile(
			join(project, '.yarn/releases/reader.cjs'),
			[
				"const { spawn } = require('node:child_process');",
				"const { writeFileSync } = require('node:fs');",
				"const { join } = require('node:path');",
				'const directory = process.env.EVERY_ASTRO_PNP_READER_PIDS;',
				"const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { stdio: 'inherit' });",
				'descendant.unref();',
				"writeFileSync(join(directory, `reader-${process.pid}`), '');",
				"writeFileSync(join(directory, `descendant-${descendant.pid}`), '');",
				"process.stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));",
			].join('\n')
		);
		const previousPidDirectory = process.env.EVERY_ASTRO_PNP_READER_PIDS;
		process.env.EVERY_ASTRO_PNP_READER_PIDS = pidDirectory;
		const controller = new AbortController();
		const cleanupStarted = Promise.withResolvers<void>();
		const cleanupRelease = Promise.withResolvers<void>();
		const pausedTerminator = async (child: ChildProcess | undefined): Promise<void> => {
			cleanupStarted.resolve();
			await cleanupRelease.promise;
			await terminateChildProcess(child);
		};
		try {
			const manifest = resolveInstalledPackageManifest(
				'astro',
				project,
				undefined,
				controller.signal,
				undefined,
				pausedTerminator
			);
			await cleanupStarted.promise;
			controller.abort('during PnP reader cleanup');
			cleanupRelease.resolve();

			await expect(manifest).rejects.toMatchObject({ name: 'AbortError' });
			const pids = (await readdir(pidDirectory))
				.map((entry) => Number(entry.slice(entry.lastIndexOf('-') + 1)))
				.filter(Number.isSafeInteger);
			expect(pids).toHaveLength(2);
			for (const pid of pids) {
				expect(() => process.kill(pid, 0)).toThrow(/ESRCH/);
			}

			await expect(resolveInstalledPackageManifest('astro', project)).resolves.toBe(
				join(packageRoot, 'package.json')
			);
			expect(await readdir(pidDirectory)).toHaveLength(4);
		} finally {
			cleanupRelease.resolve();
			if (previousPidDirectory === undefined) delete process.env.EVERY_ASTRO_PNP_READER_PIDS;
			else process.env.EVERY_ASTRO_PNP_READER_PIDS = previousPidDirectory;
		}
	}
);

test('keeps a nonzero PnP reader stderr failure ahead of termination cleanup failure', async () => {
	const project = await createPnpArchiveProject();
	const stderr = new PassThrough();
	const reader = Object.assign(new EventEmitter(), {
		stdout: new PassThrough(),
		stderr,
	}) as unknown as ChildProcess;
	const cleanupError = new Error('could not terminate PnP reader');
	const launch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		observe?.(reader);
		process.nextTick(() => {
			stderr.write('complete Corepack stderr');
			reader.emit('exit', 1);
			reader.emit('close', 1);
		});
		return reader;
	};

	let failure: unknown;
	try {
		await resolveInstalledPackageManifest(
			'astro',
			project,
			undefined,
			undefined,
			launch,
			async () => {
				throw cleanupError;
			}
		);
	} catch (error) {
		failure = error;
	}

	expect(failure).toBeInstanceOf(AggregateError);
	const aggregate = failure as AggregateError;
	expect(aggregate.message).toBe('Could not read a PnP manifest and clean up its reader');
	expect(aggregate.cause).toBe(aggregate.errors[0]);
	expect(aggregate.errors[0]).toMatchObject({
		message: expect.stringContaining('complete Corepack stderr'),
	});
	expect(aggregate.errors[1]).toBe(cleanupError);
});

test('keeps a malformed PnP manifest ahead of temporary-root cleanup failure', async () => {
	const project = await createPnpArchiveProject();
	const stdout = new PassThrough();
	const reader = Object.assign(new EventEmitter(), {
		stdout,
		stderr: new PassThrough(),
	}) as unknown as ChildProcess;
	const cleanupError = new Error('could not remove PnP temporary root');
	const launch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		observe?.(reader);
		process.nextTick(() => {
			stdout.write('not JSON');
			reader.emit('exit', 0);
			reader.emit('close', 0);
		});
		return reader;
	};

	let failure: unknown;
	try {
		await resolveInstalledPackageManifest(
			'astro',
			project,
			undefined,
			undefined,
			launch,
			async () => undefined,
			async () => '/injected-pnp-temporary-root',
			async () => {
				throw cleanupError;
			}
		);
	} catch (error) {
		failure = error;
	}

	expect(failure).toBeInstanceOf(AggregateError);
	const aggregate = failure as AggregateError;
	expect(aggregate.message).toBe('Could not read a PnP manifest and clean up its reader');
	expect(aggregate.cause).toBe(aggregate.errors[0]);
	expect(aggregate.errors[0]).toBeInstanceOf(SyntaxError);
	expect(aggregate.errors[1]).toBe(cleanupError);
});

test('owns an injected PnP launch failure before its error event fires', async () => {
	const project = await createPnpArchiveProject();
	const reader = Object.assign(new EventEmitter(), {
		stdout: new PassThrough(),
		stderr: new PassThrough(),
	}) as unknown as ChildProcess;
	const launchError = new Error('missing Corepack reader executable');
	const terminate = vi.fn(async () => {
		reader.emit('close', null);
	});
	const launch = async (
		_temporaryRoot: string,
		_file: string,
		_args: string[],
		_options: NonNullable<Parameters<typeof spawnCross>[2]>,
		observe?: (child: ChildProcess) => void
	): Promise<ChildProcess> => {
		observe?.(reader);
		process.nextTick(() => reader.emit('error', launchError));
		return reader;
	};

	await expect(
		resolveInstalledPackageManifest('astro', project, undefined, undefined, launch, terminate)
	).rejects.toBe(launchError);
	expect(terminate).toHaveBeenCalledExactlyOnceWith(reader);
});

describe('selectLatestAstroReleaseTag', () => {
	test('selects the newest stable tag within the installed Astro major', () => {
		expect(
			selectLatestAstroReleaseTag(
				['astro@8.0.0', 'astro@7.4.1', 'astro@7.5.0-rc.1', 'astro@7.4.3', 'not-an-astro-tag'],
				7
			)
		).toBe('astro@7.4.3');
	});

	test('fails clearly when the installed major has no stable release tag', () => {
		expect(() => selectLatestAstroReleaseTag(['astro@8.0.0', 'astro@7.5.0-rc.1'], 7)).toThrow(
			'Could not find a stable Astro 7 release tag'
		);
	});

	test('requires the real stable first release before bisecting an installed major', () => {
		expect(() => assertFirstAstroReleaseTag(['astro@8.0.0-beta.1'], 8)).toThrow(
			'Astro 8 has no stable first-release bisect boundary (astro@8.0.0)'
		);
		expect(() =>
			assertFirstAstroReleaseTag(['astro@8.0.0', 'astro@8.0.0-beta.1'], 8)
		).not.toThrow();
	});

	test('selects the commit revision rather than a tag object for bisecting', () => {
		expect(selectLatestAstroReleaseRevision(['astro@7.4.3'], 7)).toBe('astro@7.4.3^{commit}');
	});
	test('uses clone HEAD when it remains in the installed major', () => {
		expect(selectLatestAstroRevision(['astro@7.4.3'], 7, '7.5.0-dev.1')).toBe('HEAD');
		expect(selectLatestAstroRevision(['astro@7.4.3'], 7, '8.0.0')).toBe('astro@7.4.3^{commit}');
	});

	test('parses quoted and unquoted Git bisect completion revisions', () => {
		expect(parseBisectCompletion('abc1234 is the first bad commit')).toBe('abc1234');
		expect(parseBisectCompletion('"abcdef0123456789" is the first bad commit')).toBe(
			'abcdef0123456789'
		);
		expect(parseBisectCompletion("abcdef0123456789 is the first 'bad' commit")).toBe(
			'abcdef0123456789'
		);
		expect(parseBisectCompletion('bisecting: 4 revisions left')).toBeUndefined();
	});

	test('fails rather than repeating an unchanged revision on unknown bisect output', () => {
		expect(() => determineBisectProgress('before', 'before', 'unrecognized completion')).toThrow(
			'Could not determine Git bisect progress'
		);
		expect(
			determineBisectProgress('before', 'after', 'bisecting: 4 revisions left')
		).toBeUndefined();
	});
});

describe('abortError', () => {
	test('uses the standard abort error name', () => {
		const controller = new AbortController();
		controller.abort('cancelled by user');

		expect(abortError(controller.signal)).toMatchObject({
			name: 'AbortError',
			message: 'Operation aborted: cancelled by user',
		});
	});
});

describe('terminateChildProcess', () => {
	test.skipIf(process.platform === 'win32')(
		'waits for the detached process group instead of only the leader',
		async () => {
			const child = spawnChild('sh', ['-c', 'sleep 30 & wait'], {
				detached: true,
				stdio: 'ignore',
			});
			await once(child, 'spawn');
			const pid = child.pid!;

			await terminateChildProcess(child, process.platform, 500);

			expect(() => process.kill(-pid, 0)).toThrow(/ESRCH/);
		}
	);

	test.skipIf(process.platform === 'win32')(
		'terminates a detached process group after its leader exits',
		async () => {
			const child = spawnChild('sh', ['-c', 'sleep 30 & exit 0'], {
				detached: true,
				stdio: 'ignore',
			});
			await once(child, 'spawn');
			const pid = child.pid!;

			try {
				await once(child, 'close');
				await terminateChildProcess(child, process.platform, 500);

				expect(() => process.kill(-pid, 0)).toThrow(/ESRCH/);
			} finally {
				try {
					process.kill(-pid, 'SIGKILL');
				} catch {
					// The process group was already terminated.
				}
			}
		}
	);

	test('shares Windows taskkill across concurrent and late stop requests', async () => {
		const child = Object.assign(new EventEmitter(), {
			pid: 4_242,
			exitCode: null,
			signalCode: null,
		}) as ChildProcess;
		const taskkill = new EventEmitter();
		const launchTaskkill = vi.fn<(pid: number) => ChildProcess>(() => taskkill as ChildProcess);
		const first = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);
		const second = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);

		expect(second).toBe(first);
		expect(launchTaskkill).toHaveBeenCalledExactlyOnceWith(4_242);
		taskkill.emit('close', 0);
		child.emit('close', 0);
		await Promise.all([first, second]);
		await terminateChildProcess(child, 'win32', 5_000, launchTaskkill);

		expect(launchTaskkill).toHaveBeenCalledExactlyOnceWith(4_242);
	});

	test('does not taskkill a Windows child that exited naturally', async () => {
		const child = { pid: 4_242, exitCode: 0, signalCode: null } as ChildProcess;
		const launchTaskkill = vi.fn<(pid: number) => ChildProcess>();
		const first = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);
		const late = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);

		expect(late).toBe(first);
		await first;
		expect(launchTaskkill).not.toHaveBeenCalled();
	});

	test('accepts a Windows taskkill race when the child exit is reported afterward', async () => {
		vi.useFakeTimers();
		try {
			const taskkill = new EventEmitter();
			const launchTaskkill = vi.fn<(pid: number) => ChildProcess>(() => taskkill as ChildProcess);
			const testChild = Object.assign(new EventEmitter(), {
				pid: 4_242,
				exitCode: null as number | null,
				signalCode: null,
			});
			const child = testChild as ChildProcess;
			const termination = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);
			taskkill.emit('close', 1);
			await Promise.resolve();
			setTimeout(() => {
				testChild.exitCode = 0;
				testChild.emit('exit', 0);
				testChild.emit('close', 0);
			}, 1);
			await vi.advanceTimersByTimeAsync(1);

			await expect(termination).resolves.toBeUndefined();
			expect(launchTaskkill).toHaveBeenCalledExactlyOnceWith(4_242);
			expect(testChild.listenerCount('exit')).toBe(0);
			expect(testChild.listenerCount('close')).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
	test.skipIf(process.platform !== 'win32')(
		'does not finish a successful Windows stop until the supervisor closes',
		async () => {
			const child = Object.assign(new EventEmitter(), {
				pid: 4_242,
				exitCode: null,
				signalCode: null,
			}) as ChildProcess;
			const taskkill = new EventEmitter();
			const termination = terminateChildProcess(
				child,
				'win32',
				5_000,
				() => taskkill as ChildProcess
			);
			let finished = false;
			void termination.then(() => {
				finished = true;
			});

			taskkill.emit('close', 0);
			await Promise.resolve();
			expect(finished).toBe(false);
			child.emit('close', 0);

			await expect(termination).resolves.toBeUndefined();
		}
	);

	test('reports a Windows taskkill failure while the child is still running', async () => {
		vi.useFakeTimers();
		try {
			const child = Object.assign(new EventEmitter(), {
				pid: 4_242,
				exitCode: null,
				signalCode: null,
			}) as ChildProcess;
			const taskkill = new EventEmitter();
			const launchTaskkill = vi.fn<(pid: number) => ChildProcess>(() => taskkill as ChildProcess);
			const termination = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);
			taskkill.emit('close', 1);
			await vi.advanceTimersByTimeAsync(100);

			await expect(termination).rejects.toThrow(
				'taskkill failed while terminating process 4242 (exit code 1)'
			);
			expect(child.listenerCount('exit')).toBe(0);
			expect(child.listenerCount('close')).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	test('evicts a failed Windows termination so a later cleanup retry can stop the child', async () => {
		vi.useFakeTimers();
		try {
			const child = Object.assign(new EventEmitter(), {
				pid: 4_242,
				exitCode: null,
				signalCode: null,
			}) as ChildProcess;
			const firstTaskkill = new EventEmitter();
			const secondTaskkill = new EventEmitter();
			const launchTaskkill = vi
				.fn<(pid: number) => ChildProcess>()
				.mockReturnValueOnce(firstTaskkill as ChildProcess)
				.mockReturnValueOnce(secondTaskkill as ChildProcess);
			const first = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);
			firstTaskkill.emit('close', 1);
			await vi.advanceTimersByTimeAsync(100);

			await expect(first).rejects.toThrow(
				'taskkill failed while terminating process 4242 (exit code 1)'
			);
			const second = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);
			secondTaskkill.emit('close', 0);
			child.emit('close', 0);

			await expect(second).resolves.toBeUndefined();
			expect(launchTaskkill).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	test('rejects an aborted command when termination fails and retries it during cleanup', async () => {
		const project = await createProject();
		const temporary = await temporaryRoot();
		const controller = new AbortController();
		const terminationError = new Error('could not terminate child');
		const terminate = vi.fn(async () => {
			throw terminationError;
		});
		const session = new RuntimeSession(
			project,
			project,
			join(temporary, 'astro'),
			temporary,
			'',
			'npm',
			false,
			{ exists: true, content: Buffer.from('{}\n') },
			{ exists: true, content: Buffer.from('{}\n') },
			join(project, 'package-lock.json'),
			{ exists: true, content: Buffer.from('{}\n') },
			[],
			new Set(),
			'',
			controller.signal,
			terminate,
			() => new EventEmitter() as ChildProcess
		);
		const controllableSession = session as unknown as {
			unlinkPackages(): Promise<void>;
			restoreDependencies(): Promise<void>;
		};
		vi.spyOn(controllableSession, 'unlinkPackages').mockResolvedValue();
		vi.spyOn(controllableSession, 'restoreDependencies').mockResolvedValue();

		const execution = session.execute(['fixture-command'], project);
		controller.abort();

		await expect(execution).rejects.toBe(terminationError);
		await expect(session.close()).rejects.toThrow('every-astro cleanup failed');
		expect(terminate).toHaveBeenCalledTimes(2);
	});

	test('bootstrap teardown retries its active clone without restoring consumer dependencies', async () => {
		const project = await createProject();
		const temporary = await temporaryRoot();
		const sentinel = join(project, 'node_modules', 'sentinel');
		await mkdir(dirname(sentinel), { recursive: true });
		await writeFile(sentinel, 'unchanged');
		const controller = new AbortController();
		const child = new EventEmitter() as ChildProcess;
		const terminationError = new Error('initial clone stop failed');
		const terminate = vi
			.fn<(child: ChildProcess | undefined) => Promise<void>>()
			.mockRejectedValueOnce(terminationError)
			.mockResolvedValueOnce(undefined);
		const commandSpawner = vi.fn(() => child);
		const session = new RuntimeSession(
			project,
			project,
			join(temporary, 'astro'),
			temporary,
			'',
			'npm',
			false,
			{ exists: true, content: Buffer.from('{}\n') },
			{ exists: true, content: Buffer.from('{}\n') },
			join(project, 'package-lock.json'),
			{ exists: true, content: Buffer.from('{}\n') },
			[],
			new Set(),
			'',
			controller.signal,
			terminate,
			commandSpawner
		);
		const clone = session.execute(['git', 'clone', 'fixture'], temporary);
		controller.abort();

		await expect(clone).rejects.toBe(terminationError);
		await expect(session.closeBootstrap()).resolves.toBeUndefined();
		expect(terminate).toHaveBeenCalledTimes(2);
		expect(commandSpawner).toHaveBeenCalledExactlyOnceWith('git', ['clone', 'fixture'], {
			cwd: temporary,
			detached: process.platform !== 'win32',
			env: undefined,
			stdio: 'inherit',
		});
		await expect(readFile(sentinel, 'utf8')).resolves.toBe('unchanged');
	});
	test('keeps a development-server early-exit error ahead of its stop failure', async () => {
		const project = await createProject();
		const temporary = await temporaryRoot();
		const child = new EventEmitter() as ChildProcess;
		const stopError = new Error('could not stop development server');
		const terminate = vi.fn(async () => {
			throw stopError;
		});
		const session = new RuntimeSession(
			project,
			project,
			join(temporary, 'astro'),
			temporary,
			'',
			'npm',
			false,
			{ exists: true, content: Buffer.from('{}\n') },
			{ exists: true, content: Buffer.from('{}\n') },
			join(project, 'package-lock.json'),
			{ exists: true, content: Buffer.from('{}\n') },
			[],
			new Set(),
			'',
			new AbortController().signal,
			terminate,
			() => {
				process.nextTick(() => child.emit('exit', 1));
				return child;
			}
		);

		let failure: unknown;
		try {
			await session.runDevServerAndAsk('revision');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(AggregateError);
		const aggregate = failure as AggregateError;
		expect(aggregate.cause).toBe(aggregate.errors[0]);
		expect(aggregate.errors[0]).toMatchObject({ name: 'CommandError' });
		expect(aggregate.errors[1]).toBe(stopError);
	});
});

describe('windowsJobSupervisorCommand', () => {
	test('passes a JSON control-file path to the shipped PowerShell supervisor', () => {
		const command = windowsJobSupervisorCommand('C:\\temp\\every-astro-command.json');

		expect(command[0]).toBe('powershell.exe');
		expect(command).toContain('-File');
		expect(command[command.indexOf('-File') + 1]).toMatch(/src[\\/]windows-job-supervisor\.ps1$/);
		expect(command.slice(-2)).toEqual(['-ControlFile', 'C:\\temp\\every-astro-command.json']);
	});
});

test.skipIf(process.platform !== 'win32')(
	'forwards Unicode arguments and kills a delayed descendant when the Job Object closes',
	async () => {
		const root = await temporaryRoot();
		const toolRoot = join(root, 'job café');
		const batchFile = join(toolRoot, 'runner.cmd');
		const targetScript = join(toolRoot, 'target.mjs');
		const descendantScript = join(toolRoot, 'descendant.mjs');
		const sentinelFile = join(root, 'descendant-survived');
		const startedFile = join(root, 'descendant-started');
		const argumentsFile = join(root, 'arguments.json');
		const forwarded = ['spaced argument', 'café', '%literal%', 'a&b'];
		const controlFile = join(root, 'command.json');
		await mkdir(toolRoot);
		await writeFile(
			descendantScript,
			[
				"import { writeFileSync } from 'node:fs';",
				"import { writeFile } from 'node:fs/promises';",
				"import { setTimeout as delay } from 'node:timers/promises';",
				"writeFileSync(process.argv[2], 'started');",
				'await delay(250);',
				"await writeFile(process.argv[3], 'escaped');",
			].join('\n')
		);
		await writeFile(
			targetScript,
			[
				"import { spawn } from 'node:child_process';",
				"import { existsSync } from 'node:fs';",
				"import { writeFile } from 'node:fs/promises';",
				"import { setTimeout as delay } from 'node:timers/promises';",
				'const [argumentsFile, startedFile, sentinelFile, ...forwarded] = process.argv.slice(2);',
				'await writeFile(argumentsFile, JSON.stringify(forwarded));',
				`const descendant = spawn(process.execPath, [${JSON.stringify(descendantScript)}, startedFile, sentinelFile], {`,
				"\tstdio: 'ignore',",
				'});',
				'descendant.unref();',
				'const deadline = Date.now() + 5_000;',
				'while (!existsSync(startedFile)) {',
				"\tif (Date.now() >= deadline) throw new Error('Descendant did not start');",
				'\tawait delay(10);',
				'}',
				"console.log('ready');",
				'await delay(600);',
			].join('\n')
		);
		await writeFile(batchFile, `@echo off\r\n"${process.execPath}" "${targetScript}" %*\r\n`);
		await writeFile(
			controlFile,
			JSON.stringify({
				file: batchFile,
				args: [argumentsFile, startedFile, sentinelFile, ...forwarded],
			})
		);
		const [file, ...args] = windowsJobSupervisorCommand(controlFile);
		let supervisor: ChildProcess | undefined;
		try {
			supervisor = spawnChild(file, args, {
				cwd: root,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
			const runningSupervisor = supervisor;
			const stdout = runningSupervisor.stdout!;
			const stderr = runningSupervisor.stderr!;
			let output = '';
			await new Promise<void>((resolveReady, rejectReady) => {
				let settled = false;
				let timeout: NodeJS.Timeout | undefined;
				const ready = () => finish();
				const failed = (error: Error) => finish(error);
				const closed = (exitCode: number | null) =>
					finish(
						new Error(
							`Supervisor exited before readiness (exit code ${exitCode ?? 'signal'})${output ? `:\n${output}` : ''}`
						)
					);
				const captureStderr = (chunk: Buffer) => {
					output += chunk.toString();
				};
				const cleanup = () => {
					clearTimeout(timeout);
					stdout.removeListener('data', ready);
					stderr.removeListener('data', captureStderr);
					runningSupervisor.removeListener('error', failed);
					runningSupervisor.removeListener('close', closed);
				};
				const finish = (error?: Error) => {
					if (settled) return;
					settled = true;
					cleanup();
					if (error) rejectReady(error);
					else resolveReady();
				};
				stdout.once('data', ready);
				stderr.on('data', captureStderr);
				runningSupervisor.once('error', failed);
				runningSupervisor.once('close', closed);
				// This native-process readiness deadline cannot be driven by Vitest fake timers.
				timeout = setTimeout(
					() =>
						finish(
							new Error(
								`Supervisor did not signal readiness within 10 seconds${output ? `:\n${output}` : ''}`
							)
						),
					10_000
				);
			});
			await expect(readFile(startedFile, 'utf8')).resolves.toBe('started');
			await expect(readFile(argumentsFile, 'utf8').then(JSON.parse)).resolves.toEqual(forwarded);
			const closed = once(runningSupervisor, 'close');
			expect(runningSupervisor.kill()).toBe(true);
			await closed;

			// The external descendant uses the Windows scheduler, which Vitest fake timers cannot drive.
			await delay(750);
			await expect(readFile(sentinelFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
		} finally {
			if (supervisor?.exitCode === null && supervisor.signalCode === null) {
				const closed = once(supervisor, 'close');
				supervisor.kill();
				await closed;
			}
		}
	}
);

describe('windowsBatchCommandTail', () => {
	test('ports cross-spawn escaping for batch paths, spaces, percent variables, and metacharacters', () => {
		expect(
			windowsBatchCommandTail('C:\\tool path\\runner.cmd', ['spaced argument', '%literal%', 'a&b'])
		).toBe('/d /s /c "C:\\tool^ path\\runner.cmd ^"spaced^ argument^" ^"^%literal^%^" ^"a^&b^""');
		expect(windowsBatchCommandTail('C:\\p\\node_modules\\.bin\\tool.cmd', ['a&b'])).toBe(
			'/d /s /c "C:\\p\\node_modules\\.bin\\tool.cmd ^^^"a^^^&b^^^""'
		);
		expect(windowsBatchCommandTail('C:\\p\\node_modules\\.bin\\nested\\tool.cmd', ['a&b'])).toBe(
			'/d /s /c "C:\\p\\node_modules\\.bin\\nested\\tool.cmd ^"a^&b^""'
		);
	});
});

describe('developmentServerStdio', () => {
	test('reserves stdin for the interactive bisect prompt', () => {
		expect(developmentServerStdio).toEqual(['ignore', 'inherit', 'inherit']);
	});
});

describe('detectPackageManager', () => {
	test('uses the ancestor Yarn workspace lockfile root for a nested declaration', async () => {
		const workspace = await createProject({ private: true });
		const project = join(workspace, 'apps', 'astro-project');
		await writeJson(join(project, 'package.json'), {
			name: 'astro-project',
			packageManager: 'yarn@4.6.0',
		});
		await writeFile(join(workspace, 'yarn.lock'), 'fixture\n');

		await expect(detectPackageManagerRoot(project)).resolves.toBe(workspace);
	});
	test('prefers a valid packageManager declaration over lockfiles', async () => {
		const project = await createProject({ packageManager: 'yarn@4.6.0' });
		await writeFile(join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');

		await expect(detectPackageManager(project)).resolves.toBe('yarn');
	});

	test.each([
		['pnpm-lock.yaml', 'pnpm'],
		['yarn.lock', 'yarn'],
		['bun.lock', 'bun'],
		['package-lock.json', 'npm'],
	] as const)(
		'detects %s when no packageManager is declared',
		async (lockfile: string, manager: PackageManager) => {
			const project = await createProject();
			await writeFile(join(project, lockfile), 'fixture\n');

			await expect(detectPackageManager(project)).resolves.toBe(manager);
		}
	);
});

describe('packageLinkCommands', () => {
	test('does not invoke Bun when packages are linked directly into node_modules', () => {
		const project = '/project';
		const links = [
			{ name: 'astro', path: '/checkout/packages/astro' },
			{ name: '@astrojs/compiler', path: '/checkout/packages/compiler' },
		];

		expect(packageLinkCommands('bun', false, project, links)).toEqual([]);
	});

	test('keeps checkout directory paths for pnpm linking', () => {
		const project = '/project';
		const links = [
			{ name: 'astro', path: '/checkout/packages/astro' },
			{ name: '@astrojs/compiler', path: '/checkout/packages/compiler' },
		];

		expect(packageLinkCommands('pnpm', false, project, links)).toEqual(
			links.map(({ path }) => ({ command: ['pnpm', 'link', path], cwd: project }))
		);
	});

	test('replaces Bun-installed packages with the checked-out revision', async () => {
		const project = await createProject({ dependencies: { astro: '7.0.0' } });
		const revision = await temporaryRoot();
		await writePackage(project, 'node_modules/astro', {
			name: 'astro',
			version: '7.0.0',
		});
		await writeJson(join(revision, 'package.json'), {
			name: 'astro',
			version: '0.0.0-revision',
		});

		await linkBunPackage(project, { name: 'astro', path: revision });

		await expect(installedAstroMajor(project)).resolves.toBe(0);
	});

	test('links new scoped workspace dependencies absent from the original Bun installation', async () => {
		const project = await createProject({ dependencies: { astro: '7.0.0' } });
		const revision = await temporaryRoot();
		await writePackage(project, 'node_modules/astro', {
			name: 'astro',
			version: '7.0.0',
		});
		await writeJson(join(revision, 'package.json'), {
			name: '@astrojs/new-helper',
			version: '0.0.0-revision',
		});

		await expect(
			linkBunPackage(project, { name: '@astrojs/new-helper', path: revision })
		).resolves.toBe(join(project, 'node_modules', '@astrojs/new-helper'));
		await expect(readlink(join(project, 'node_modules', '@astrojs/new-helper'))).resolves.toBe(
			revision
		);
	});

	test('uses publish-shaped file descriptors for Classic Yarn packages', () => {
		const project = '/project';
		const links = [
			{ name: 'astro', path: '/checkout/packages/astro-7.0.0.tgz' },
			{ name: '@astrojs/compiler', path: '/checkout/packages/compiler-2.0.0.tgz' },
		];

		expect(packageLinkCommands('yarn', false, project, links)).toEqual([
			{
				command: [
					'yarn',
					'add',
					'--pure-lockfile',
					'--ignore-workspace-root-check',
					...links.map(({ name, path }) => `${name}@file:${path}`),
				],
				cwd: project,
			},
		]);
	});

	test('uses publish-shaped file descriptors for Yarn Berry packages', () => {
		const project = '/project';
		const links = [
			{ name: 'astro', path: '/checkout/packages/astro-7.0.0.tgz' },
			{ name: '@astrojs/compiler', path: '/checkout/packages/compiler-2.0.0.tgz' },
		];

		expect(packageLinkCommands('yarn', true, project, links)).toEqual([
			{
				command: [
					'yarn',
					'add',
					'astro@file:/checkout/packages/astro-7.0.0.tgz',
					'@astrojs/compiler@file:/checkout/packages/compiler-2.0.0.tgz',
				],
				cwd: project,
			},
		]);
	});
});

describe('packed workspace package activation', () => {
	test.skipIf(process.platform === 'win32')(
		'activates a workspace-protocol graph with npm and Yarn PnP without network access',
		async () => {
			const workspace = await temporaryRoot();
			const helper = join(workspace, 'packages/helper');
			const astro = join(workspace, 'packages/astro');
			const archives = join(workspace, 'archives');
			await writeJson(join(workspace, 'package.json'), { name: 'workspace', private: true });
			await writeFile(join(workspace, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
			await writePackage(workspace, 'packages/helper', {
				name: '@astrojs/helper',
				version: '1.0.0',
				main: 'index.js',
			});
			await writeFile(join(helper, 'index.js'), 'module.exports = "local helper";\n');
			await writePackage(workspace, 'packages/astro', {
				name: 'astro',
				version: '7.0.0',
				main: 'index.js',
				dependencies: { '@astrojs/helper': 'workspace:*' },
			});
			await writeFile(join(astro, 'index.js'), 'module.exports = require("@astrojs/helper");\n');
			await runCommand('pnpm', ['install', '--offline'], workspace);
			await mkdir(archives, { recursive: true });
			await runCommand('pnpm', ['pack', '--pack-destination', archives], helper);
			await runCommand('pnpm', ['pack', '--pack-destination', archives], astro);
			const packedArchives = (await readdir(archives)).map((archive) => join(archives, archive));
			const astroArchive = packedArchives.find((archive) => archive.endsWith('astro-7.0.0.tgz'))!;
			const helperArchive = packedArchives.find((archive) =>
				archive.endsWith('astrojs-helper-1.0.0.tgz')
			)!;

			const npmProject = await createProject();
			await runCommand(
				'npm',
				['install', '--offline', '--no-save', '--package-lock=false', helperArchive, astroArchive],
				npmProject
			);
			await expect(
				runCommand(
					process.execPath,
					['-e', 'process.exit(require("astro") === "local helper" ? 0 : 1)'],
					npmProject
				)
			).resolves.toBe('');

			const yarnProject = await createProject({ packageManager: 'yarn@4.17.1' });
			await writeFile(join(yarnProject, '.yarnrc.yml'), 'nodeLinker: pnp\n');
			await writeJson(join(yarnProject, 'package.json'), {
				name: 'test-project',
				packageManager: 'yarn@4.17.1',
				resolutions: {
					'@astrojs/helper': `file:${helperArchive}`,
					astro: `file:${astroArchive}`,
				},
			});
			await runCommand(
				'yarn',
				[
					'add',
					'--mode=skip-build',
					`@astrojs/helper@file:${helperArchive}`,
					`astro@file:${astroArchive}`,
				],
				yarnProject,
				{ YARN_ENABLE_NETWORK: '0' }
			);
			await expect(
				runCommand(
					'yarn',
					['node', '-e', 'process.exit(require("astro") === "local helper" ? 0 : 1)'],
					yarnProject,
					{ YARN_ENABLE_NETWORK: '0' }
				)
			).resolves.toBe('');
			const previousPath = process.env.PATH;
			process.env.PATH = join(yarnProject, 'no-bare-yarn');
			try {
				const astroManifest = await resolveInstalledPackageManifest('astro', yarnProject);

				expect(astroManifest).toMatch(/\.zip[\\/]node_modules[\\/]astro[\\/]package\.json$/);
				await expect(installedAstroMajor(yarnProject)).resolves.toBe(7);
				await expect(collectInstalledDependencyNames(yarnProject)).resolves.toEqual(
					new Set(['astro', '@astrojs/helper'])
				);
			} finally {
				if (previousPath === undefined) delete process.env.PATH;
				else process.env.PATH = previousPath;
			}
		}
	);
});

describe('restoreDependencySymlink', () => {
	test('restores the saved directory link target', async () => {
		const project = await createProject({ dependencies: { astro: '7.0.0' } });
		const originalPackage = join(project, 'packages', 'original-astro');
		const replacementPackage = join(project, 'packages', 'replacement-astro');
		const packagePath = join(project, 'node_modules', 'astro');
		await writePackage(project, 'packages/original-astro', { name: 'astro', version: '7.0.0' });
		await writePackage(project, 'packages/replacement-astro', {
			name: 'astro',
			version: '0.0.0-revision',
		});
		await mkdir(join(project, 'node_modules'), { recursive: true });
		await symlink(replacementPackage, packagePath, 'dir');

		await restoreDependencySymlink({
			path: packagePath,
			target: originalPackage,
			type: 'dir',
		});

		await expect(readlink(packagePath)).resolves.toBe(originalPackage);
		await expect(installedAstroMajor(project)).resolves.toBe(7);
	});

	test.skipIf(process.platform !== 'win32')(
		'preserves relative symbolic links and junctions through the dependency snapshot and restore cycle',
		async () => {
			const project = await createProject();
			const symbolicTarget = join(project, 'packages', 'symbolic-target');
			const junctionTarget = join(project, 'packages', 'junction-target');
			const symbolicLink = join(project, 'node_modules', 'astro');
			const junctionLink = join(project, 'node_modules', '@astrojs', 'junction');
			await Promise.all([
				mkdir(symbolicTarget, { recursive: true }),
				mkdir(junctionTarget, { recursive: true }),
				mkdir(dirname(symbolicLink), { recursive: true }),
				mkdir(dirname(junctionLink), { recursive: true }),
			]);
			const relativeTarget = join('..', 'packages', 'symbolic-target');
			await symlink(relativeTarget, symbolicLink, 'dir');
			await symlink(junctionTarget, junctionLink, 'junction');

			const snapshots = await snapshotDependencySymlinks(
				project,
				project,
				new Set(['astro', '@astrojs/junction'])
			);
			const byPath = new Map(snapshots.map((snapshot) => [snapshot.path, snapshot]));
			expect(byPath.get(symbolicLink)).toMatchObject({
				target: relativeTarget,
				type: 'dir',
			});
			expect(byPath.get(junctionLink)).toMatchObject({ type: 'junction' });

			await rm(symbolicLink, { recursive: true, force: true });
			await rm(junctionLink, { recursive: true, force: true });
			await Promise.all(snapshots.map((snapshot) => restoreDependencySymlink(snapshot)));

			expect((await lstat(symbolicLink)).isSymbolicLink()).toBe(true);
			await expect(readlink(symbolicLink)).resolves.toBe(relativeTarget);
			const restored = await snapshotDependencySymlinks(
				project,
				project,
				new Set(['@astrojs/junction'])
			);
			expect(restored).toHaveLength(1);
			expect(restored[0]).toMatchObject({ path: junctionLink, type: 'junction' });
		}
	);
});

describe('isolatedBootstrapEnvironment', () => {
	test('removes consumer Node loader hooks without changing other environment values', () => {
		expect(
			isolatedBootstrapEnvironment({
				NODE_OPTIONS: '--require /project/.pnp.cjs',
				COREPACK_HOME: '/cache/corepack',
			})
		).toEqual({ COREPACK_HOME: '/cache/corepack' });
	});

	test('removes loaders after quoted tabs and newlines while preserving raw retained tokens', async () => {
		const nodeOptions =
			'--conditions="line\tbreak\nstill" --require "./project hook.cjs" --trace-warnings';
		const environment = isolatedBootstrapEnvironment({ NODE_OPTIONS: nodeOptions });

		expect(environment).toEqual({
			NODE_OPTIONS: '--conditions="line\tbreak\nstill"   --trace-warnings',
		});
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).resolves.toMatch(/^v/);
	});

	test('removes loaders whose names concatenate escaped double-quoted segments', async () => {
		const environment = isolatedBootstrapEnvironment({
			NODE_OPTIONS: '--requ"\\i"re "./project hook.cjs" --trace-warnings',
		});

		expect(environment).toEqual({ NODE_OPTIONS: '  --trace-warnings' });
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).resolves.toMatch(/^v/);
	});

	test.each([
		[
			'require equals',
			'--require="./project hook.cjs"',
			'--trace-warnings  --conditions=development',
		],
		[
			'import separate',
			'--import "./project hook.cjs"',
			'--trace-warnings   --conditions=development',
		],
		[
			'loader equals',
			'--loader="./project hook.cjs"',
			'--trace-warnings  --conditions=development',
		],
		[
			'experimental loader separate',
			'--experimental-loader "./project hook.cjs"',
			'--trace-warnings   --conditions=development',
		],
		[
			'underscored experimental loader equals',
			'--experimental_loader="./project hook.cjs"',
			'--trace-warnings  --conditions=development',
		],
	])('removes valid %s syntax', async (_name, loaderOption, expectedNodeOptions) => {
		const environment = isolatedBootstrapEnvironment({
			NODE_OPTIONS: `--trace-warnings ${loaderOption} --conditions=development`,
		});

		expect(environment).toEqual({
			NODE_OPTIONS: expectedNodeOptions,
		});
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).resolves.toMatch(/^v/);
	});

	test.each([
		['missing operand', '--require'],
		['option operand', '--import --trace-warnings'],
		['empty long equals value', '--loader=""'],
		['invalid short equals form', '-r=./project-hook.cjs'],
	])('preserves malformed loader syntax for Node to reject: %s', async (_name, nodeOptions) => {
		const environment = isolatedBootstrapEnvironment({ NODE_OPTIONS: nodeOptions });

		expect(environment).toEqual({ NODE_OPTIONS: nodeOptions });
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).rejects.toThrow(/not allowed in NODE_OPTIONS|requires an argument/);
	});

	test('preserves literal single quotes and removes a later real loader', async () => {
		const environment = isolatedBootstrapEnvironment({
			NODE_OPTIONS: "--conditions='foo --require ./project-hook.cjs --trace-warnings",
		});

		expect(environment).toEqual({ NODE_OPTIONS: "--conditions='foo   --trace-warnings" });
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).resolves.toMatch(/^v/);
	});

	test('preserves exact no-loader whitespace and single-quoted tokens', async () => {
		const nodeOptions = `  --conditions="foo\\" bar"   '--require' ./project-hook.cjs  `;
		const environment = isolatedBootstrapEnvironment({ NODE_OPTIONS: nodeOptions });

		expect(environment).toEqual({ NODE_OPTIONS: nodeOptions });
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).resolves.toMatch(/^v/);
	});

	test.each([
		['tab', '\t'],
		['newline', '\n'],
	])('preserves Node-rejected %s separators', async (_name, separator) => {
		const nodeOptions = `--trace-warnings${separator}--conditions=foo`;
		const environment = isolatedBootstrapEnvironment({ NODE_OPTIONS: nodeOptions });

		expect(environment).toEqual({ NODE_OPTIONS: nodeOptions });
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).rejects.toThrow('not allowed in NODE_OPTIONS');
	});

	test('preserves malformed double-quoted Node options for Node to reject', async () => {
		const nodeOptions = '--conditions="unterminated';
		const environment = isolatedBootstrapEnvironment({ NODE_OPTIONS: nodeOptions });

		expect(environment).toEqual({ NODE_OPTIONS: nodeOptions });
		await expect(
			runCommand(process.execPath, ['--version'], process.cwd(), environment)
		).rejects.toThrow('invalid value for NODE_OPTIONS');
	});
});

describe('createRuntimeDependencies', () => {
	test('refuses to start a session without a restorable lockfile', async () => {
		const project = await createProject({
			packageManager: 'npm@11.4.2',
			dependencies: { astro: '^7.0.0' },
		});
		await writePackage(project, 'node_modules/astro', { name: 'astro', version: '7.0.0' });
		const controller = new AbortController();
		const dependencies = await createRuntimeDependencies(project, controller.signal);
		expect(dependencies.signal).toBe(controller.signal);

		await expect(dependencies.createSession()).rejects.toThrow(
			'every-astro requires a npm lockfile to restore the exact dependency tree'
		);
	});

	test('coalesces concurrent Corepack PnP reads of the same archive manifest', async () => {
		const project = await createProject({
			packageManager: 'yarn@4.17.1',
			dependencies: { astro: '7.0.0' },
		});
		const packageRoot = join(project, '.yarn/cache/astro.zip/node_modules/astro');
		const launches = join(project, 'pnp-reader-launches');
		await mkdir(join(project, '.yarn/cache'), { recursive: true });
		await mkdir(join(project, '.yarn/releases'), { recursive: true });
		await writeFile(join(project, '.yarn/cache/astro.zip'), '');
		await writeFile(
			join(project, '.pnp.cjs'),
			`exports.resolveToUnqualified = (request) => request === 'astro' ? ${JSON.stringify(packageRoot)} : null;\n`
		);
		await writeFile(
			join(project, '.yarnrc.yml'),
			'yarnPath: .yarn/releases/reader.cjs\nnodeLinker: pnp\n'
		);
		await writeFile(
			join(project, '.yarn/releases/reader.cjs'),
			[
				"const { appendFileSync } = require('node:fs');",
				`appendFileSync(${JSON.stringify(launches)}, 'reader\\n');`,
				"process.stdout.write(JSON.stringify({ name: 'astro', version: '7.0.0' }));",
			].join('\n')
		);

		await expect(
			createRuntimeDependencies(project, new AbortController().signal)
		).resolves.toBeDefined();
		await expect(readFile(launches, 'utf8')).resolves.toBe('reader\n');
	});

	test('aborts and reaps the Corepack Yarn PnP manifest reader process tree', async () => {
		const project = await createProject({
			packageManager: 'yarn@4.17.1',
			dependencies: { astro: '7.0.0' },
		});
		const pidDirectory = join(project, 'reader-pids');
		const packageRoot = join(project, '.yarn/cache/astro.zip/node_modules/astro');
		const previousPidDirectory = process.env.EVERY_ASTRO_PNP_READER_PIDS;
		await mkdir(pidDirectory, { recursive: true });
		await mkdir(join(project, '.yarn/cache'), { recursive: true });
		await writeFile(join(project, '.yarn/cache/astro.zip'), '');
		await writeFile(
			join(project, '.pnp.cjs'),
			`exports.resolveToUnqualified = (request) => request === 'astro' ? ${JSON.stringify(packageRoot)} : null;\n`
		);
		await writeFile(
			join(project, '.yarnrc.yml'),
			'yarnPath: .yarn/releases/hang.cjs\nnodeLinker: pnp\n'
		);
		await mkdir(join(project, '.yarn/releases'), { recursive: true });
		// The fixture keeps the real Corepack/Yarn reader and its descendant alive until abort.
		await writeFile(
			join(project, '.yarn/releases/hang.cjs'),
			[
				"const { spawn } = require('node:child_process');",
				"const { mkdirSync, writeFileSync } = require('node:fs');",
				"const { join } = require('node:path');",
				'const directory = process.env.EVERY_ASTRO_PNP_READER_PIDS;',
				"if (!directory) throw new Error('Missing PID directory');",
				'mkdirSync(directory, { recursive: true });',
				"const descendant = spawn(process.execPath, ['-e', \"const { writeFileSync } = require('node:fs'); const { join } = require('node:path'); writeFileSync(join(process.env.EVERY_ASTRO_PNP_READER_PIDS, `descendant-${process.pid}`), ''); setInterval(() => {}, 1_000);\"], { stdio: 'ignore' });",
				'descendant.unref();',
				"writeFileSync(join(directory, `reader-${process.pid}`), '');",
				'setInterval(() => {}, 1_000);',
			].join('\n')
		);
		process.env.EVERY_ASTRO_PNP_READER_PIDS = pidDirectory;
		const controller = new AbortController();
		try {
			const dependencies = createRuntimeDependencies(project, controller.signal);
			// Filesystem readiness comes from external processes, so Vitest fake timers cannot drive it.
			let pids: number[] = [];
			for (let attempt = 0; attempt < 100; attempt += 1) {
				pids = (await readdir(pidDirectory))
					.map((entry) => Number(entry.slice(entry.lastIndexOf('-') + 1)))
					.filter(Number.isSafeInteger);
				if (pids.length >= 2) break;
				await delay(10);
			}
			expect(pids.length).toBeGreaterThanOrEqual(2);

			controller.abort('cancel PnP reader');
			await expect(dependencies).rejects.toMatchObject({ name: 'AbortError' });
			for (const pid of pids) {
				expect(() => process.kill(pid, 0)).toThrow(/ESRCH/);
			}
		} finally {
			if (previousPidDirectory === undefined) delete process.env.EVERY_ASTRO_PNP_READER_PIDS;
			else process.env.EVERY_ASTRO_PNP_READER_PIDS = previousPidDirectory;
		}
	});
});

describe('discoverAstroWorkspacePackages', () => {
	test('finds public Astro and scoped Astro packages but excludes private and unrelated packages', async () => {
		const repository = await temporaryRoot();
		await writePackage(repository, 'packages/astro', { name: 'astro', version: '7.0.0' });
		await writePackage(repository, 'packages/compiler', {
			name: '@astrojs/compiler',
			version: '2.0.0',
		});
		await writePackage(repository, 'packages/node', { name: '@astrojs/node', version: '9.0.0' });
		await writePackage(repository, 'packages/internal', {
			name: '@astrojs/internal',
			private: true,
		});
		await writePackage(repository, 'packages/unrelated', { name: 'unrelated-package' });

		await expect(discoverAstroWorkspacePackages(repository)).resolves.toEqual(
			new Map([
				['astro', join(repository, 'packages/astro')],
				['@astrojs/compiler', join(repository, 'packages/compiler')],
				['@astrojs/node', join(repository, 'packages/node')],
			])
		);
	});

	test('includes workspace-protocol dependencies introduced by the checked-out revision', async () => {
		const repository = await temporaryRoot();
		await writePackage(repository, 'packages/astro', {
			name: 'astro',
			version: '7.0.0',
			dependencies: { '@astrojs/new-helper': 'workspace:*' },
		});
		await writePackage(repository, 'packages/new-helper', {
			name: '@astrojs/new-helper',
			version: '1.0.0',
		});
		const packages = await discoverAstroWorkspacePackages(repository);

		await expect(
			collectAstroWorkspacePackageClosure(packages, new Set(['astro']))
		).resolves.toEqual(
			new Map([
				['astro', join(repository, 'packages/astro')],
				['@astrojs/new-helper', join(repository, 'packages/new-helper')],
			])
		);
	});
});

describe('collectInstalledDependencyNames', () => {
	test('walks scoped direct dependencies and their transitive package manifests', async () => {
		const project = await createProject({
			dependencies: { '@scope/direct': '1.0.0' },
			devDependencies: { astro: '7.0.0' },
		});
		await writePackage(project, 'node_modules/@scope/direct', {
			name: '@scope/direct',
			version: '1.0.0',
			dependencies: { 'plain-transitive': '1.0.0' },
		});
		await writePackage(project, 'node_modules/plain-transitive', {
			name: 'plain-transitive',
			version: '1.0.0',
			optionalDependencies: { '@scope/nested': '1.0.0' },
		});
		await writePackage(project, 'node_modules/@scope/nested', {
			name: '@scope/nested',
			version: '1.0.0',
		});
		await writePackage(project, 'node_modules/astro', { name: 'astro', version: '7.0.0' });
		await writePackage(project, 'node_modules/unreachable', {
			name: 'unreachable',
			version: '1.0.0',
		});

		await expect(collectInstalledDependencyNames(project)).resolves.toEqual(
			new Set(['@scope/direct', 'plain-transitive', '@scope/nested', 'astro'])
		);
	});

	test('walks peers from packages that export only a subpath', async () => {
		const project = await createProject({
			dependencies: { 'subpath-only': '1.0.0' },
		});
		await writePackage(project, 'node_modules/subpath-only', {
			name: 'subpath-only',
			version: '1.0.0',
			exports: { './runtime': './dist/runtime.js' },
			peerDependencies: { astro: '7.0.0', '@astrojs/node': '9.0.0' },
		});
		await writePackage(project, 'node_modules/astro', {
			name: 'astro',
			version: '7.0.0',
			exports: { './cli': './dist/cli.js' },
			peerDependencies: { '@astrojs/compiler': '2.0.0' },
		});
		await writePackage(project, 'node_modules/@astrojs/node', {
			name: '@astrojs/node',
			version: '9.0.0',
			exports: { './adapter': './dist/adapter.js' },
		});
		await writePackage(project, 'node_modules/@astrojs/compiler', {
			name: '@astrojs/compiler',
			version: '2.0.0',
			exports: { './sync': './dist/sync.js' },
		});

		await expect(installedAstroMajor(project)).resolves.toBe(7);
		await expect(collectInstalledDependencyNames(project)).resolves.toEqual(
			new Set(['subpath-only', '@astrojs/node', 'astro', '@astrojs/compiler'])
		);
	});
	test('follows pnpm store manifests through a symlinked package', async () => {
		const project = await createProject({
			dependencies: { direct: '1.0.0', astro: '7.0.0' },
		});
		const storePackage = 'node_modules/.pnpm/direct@1.0.0/node_modules/direct';
		await writePackage(project, storePackage, {
			name: 'direct',
			version: '1.0.0',
			exports: { './runtime': './dist/runtime.js' },
			dependencies: { nested: '1.0.0' },
		});
		await writePackage(project, 'node_modules/.pnpm/direct@1.0.0/node_modules/nested', {
			name: 'nested',
			version: '1.0.0',
		});
		await writePackage(project, 'node_modules/astro', { name: 'astro', version: '7.0.0' });
		await symlink(join(project, storePackage), join(project, 'node_modules/direct'), 'dir');

		await expect(collectInstalledDependencyNames(project)).resolves.toEqual(
			new Set(['astro', 'direct', 'nested'])
		);
	});
});

describe('resolveInstalledPackageManifest', () => {
	test('loads the target project PnP API without globally installing it', async () => {
		const project = await createProject();
		const packageRoot = join(project, '.yarn/cache/astro');
		await writePackage(project, '.yarn/cache/astro', { name: 'astro', version: '7.0.0' });
		await writeFile(
			join(project, '.pnp.cjs'),
			[
				`const packageRoot = ${JSON.stringify(packageRoot)};`,
				'exports.resolveToUnqualified = (request) => {',
				'\treturn request === "astro" ? packageRoot : null;',
				'};',
				'',
			].join('\n')
		);

		await expect(resolveInstalledPackageManifest('astro', project)).resolves.toBe(
			join(packageRoot, 'package.json')
		);
		await expect(resolveInstalledPackageManifest('astro', project)).resolves.toBe(
			join(packageRoot, 'package.json')
		);
	});

	test('discovers a nearest Yarn Classic .pnp.js API', async () => {
		const project = await createProject();
		const packageRoot = join(project, '.cache/astro');
		await writePackage(project, '.cache/astro', { name: 'astro', version: '7.0.0' });
		await writeFile(
			join(project, '.pnp.js'),
			[
				`const packageRoot = ${JSON.stringify(packageRoot)};`,
				'exports.resolveToUnqualified = (request) => request === "astro" ? packageRoot : null;',
				'',
			].join('\n')
		);

		await expect(resolveInstalledPackageManifest('astro', project)).resolves.toBe(
			join(packageRoot, 'package.json')
		);
	});
});
