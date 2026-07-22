import { Lazy } from '@inox-tools/utils/lazy';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { simpleFetch } from './fetch';

type PackageInformation = {
	name: string;
	version: string;
};

const localPackages = Lazy.of(() => {
	const packagesDir = new URL('packages/', import.meta.env.ASTRO_PROJECT_ROOT);
	const entries = readdirSync(packagesDir, {
		recursive: false,
		encoding: 'utf-8',
		withFileTypes: true,
	});
	const packages = new Map<string, PackageInformation>();

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const packageJsonPath = join(entry.parentPath, entry.name, 'package.json');
		if (!existsSync(packageJsonPath)) continue;

		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageInformation;

		packages.set(packageJson.name, packageJson);
	}

	return packages;
});

export function getLocalPackageInformation(packageName: string) {
	return localPackages.get().get(packageName);
}

export function isUnpublishedPackage(packageName: string) {
	return getLocalPackageInformation(packageName)?.version === '0.0.0';
}

export async function getPackageVersion(packageName: string) {
	const localPackage = getLocalPackageInformation(packageName);
	if (localPackage) return localPackage.version;

	// Do not reach for NPM while in development
	if (import.meta.env.DEV) return '0.0.0-dev';

	const url = `https://registry.npmjs.org/${packageName}/latest`;
	const response = await simpleFetch(url);

	if (!response.ok) {
		throw new Error(
			`npm API call failed: GET "${url}" returned status ${response.status}: ${JSON.stringify(response.body)}`
		);
	}

	const packageInformation = response.body as Pick<PackageInformation, 'version'>;
	return packageInformation.version;
}
