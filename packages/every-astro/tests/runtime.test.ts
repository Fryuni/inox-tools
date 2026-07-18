import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
	collectInstalledDependencyNames,
	detectPackageManager,
	discoverAstroWorkspacePackages,
	resolveInstalledPackageManifest,
	installedAstroMajor,
} from '../src/runtime.js';

const temporaryRoots: string[] = [];
type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm';

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

describe('detectPackageManager', () => {
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
});
