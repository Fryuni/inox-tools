import { type ChildProcess, spawn as spawnChild } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { createRequire } from 'node:module';
import {
	mkdir,
	mkdtemp,
	readFile,
	readlink,
	readdir,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
	dependencySymlinkType,
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
		const child = { pid: 4_242, exitCode: null, signalCode: null } as ChildProcess;
		const taskkill = new EventEmitter();
		const launchTaskkill = vi.fn<(pid: number) => ChildProcess>(() => taskkill as ChildProcess);
		const first = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);
		const second = terminateChildProcess(child, 'win32', 5_000, launchTaskkill);

		expect(second).toBe(first);
		expect(launchTaskkill).toHaveBeenCalledExactlyOnceWith(4_242);
		taskkill.emit('close', 0);
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
	'forwards Unicode arguments through a Unicode batch target and removes its control file',
	async () => {
		const root = await temporaryRoot();
		const toolRoot = join(root, 'tool path café');
		const batchFile = join(toolRoot, 'runner.cmd');
		const targetScript = join(toolRoot, 'target.mjs');
		const argumentsFile = join(root, 'arguments.json');
		const controlFile = join(root, 'command.json');
		const forwarded = ['spaced argument', 'café', '%literal%', 'a&b'];
		await mkdir(toolRoot);
		await writeFile(
			targetScript,
			[
				"import { writeFile } from 'node:fs/promises';",
				'await writeFile(process.argv[2], JSON.stringify(process.argv.slice(3)));',
			].join('\n')
		);
		await writeFile(batchFile, `@echo off\r\n"${process.execPath}" "${targetScript}" %*\r\n`);
		await writeFile(
			controlFile,
			JSON.stringify({
				file: batchFile,
				args: [argumentsFile, ...forwarded],
			})
		);
		const [file, ...args] = windowsJobSupervisorCommand(controlFile);
		const child = spawnChild(file, args, { cwd: root, stdio: 'ignore' });

		const [exitCode] = (await once(child, 'close')) as [number | null];

		expect(exitCode).toBe(0);
		await expect(readFile(argumentsFile, 'utf8').then(JSON.parse)).resolves.toEqual(forwarded);
		await expect(readFile(controlFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
	}
);

test.skipIf(process.platform !== 'win32')(
	'kills a delayed descendant when the supervisor closes its Job Object',
	async () => {
		const root = await temporaryRoot();
		const toolRoot = join(root, 'job café');
		const batchFile = join(toolRoot, 'runner.cmd');
		const targetScript = join(toolRoot, 'target.mjs');
		const descendantScript = join(toolRoot, 'descendant.mjs');
		const sentinelFile = join(root, 'descendant-survived');
		const controlFile = join(root, 'command.json');
		await mkdir(toolRoot);
		await writeFile(
			descendantScript,
			[
				"import { writeFile } from 'node:fs/promises';",
				"import { setTimeout as delay } from 'node:timers/promises';",
				'await delay(250);',
				"await writeFile(process.argv[2], 'escaped');",
			].join('\n')
		);
		await writeFile(
			targetScript,
			[
				"import { spawn } from 'node:child_process';",
				"import { setTimeout as delay } from 'node:timers/promises';",
				`const descendant = spawn(process.execPath, [${JSON.stringify(descendantScript)}, process.argv[2]], {`,
				"\tstdio: 'ignore',",
				'});',
				'descendant.unref();',
				"console.log('ready');",
				'await delay(600);',
			].join('\n')
		);
		await writeFile(batchFile, `@echo off\r\n"${process.execPath}" "${targetScript}" %*\r\n`);
		await writeFile(
			controlFile,
			JSON.stringify({
				file: batchFile,
				args: [sentinelFile],
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
								`Supervisor did not signal readiness within 2 seconds${output ? `:\n${output}` : ''}`
							)
						),
					2_000
				);
			});
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

	test('uses junctions for Windows directory links', () => {
		expect(dependencySymlinkType('win32')).toBe('junction');
	});
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

	test('preserves unrelated Node options while removing all loader hook forms', () => {
		expect(
			isolatedBootstrapEnvironment({
				NODE_OPTIONS:
					'--max-old-space-size=4096 --require "/project/.pnp.cjs" -r=./register.cjs --import "./instrumentation.mjs" --loader=./loader.mjs --experimental-loader "./legacy loader.mjs" --conditions="development test" --trace-warnings',
			})
		).toEqual({
			NODE_OPTIONS: '--max-old-space-size=4096 --conditions="development test" --trace-warnings',
		});
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
	test('loads and caches the target project PnP API before resolving packages', async () => {
		const project = await createProject();
		const packageRoot = join(project, '.yarn/cache/astro');
		const marker = `__everyAstroPnpSetup${temporaryRoots.length}`;
		await writePackage(project, '.yarn/cache/astro', { name: 'astro', version: '7.0.0' });
		await writeFile(
			join(project, '.pnp.cjs'),
			[
				`const packageRoot = ${JSON.stringify(packageRoot)};`,
				`const marker = ${JSON.stringify(marker)};`,
				'exports.setup = () => { globalThis[marker] = (globalThis[marker] ?? 0) + 1; };',
				'exports.resolveToUnqualified = (request) => {',
				'\tif (!globalThis[marker]) throw new Error("PnP setup was not called");',
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
		expect((globalThis as Record<string, unknown>)[marker]).toBe(1);
		delete (globalThis as Record<string, unknown>)[marker];
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
