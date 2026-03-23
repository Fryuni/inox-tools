import type { AstroConfig } from 'astro';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// https://github.com/withastro/astro/blob/fd508a0f/packages/astro/src/content/utils.ts#L456
const possibleConfigs = [
	'content.config.ts',
	'content.config.mjs',
	'content.config.js',
	'content.config.mts',
	'content/config.ts',
	'content/config.mjs',
	'content/config.js',
	'content/config.mts',
];

export type ResolvedContentPaths = {
	projectRoot: string;
	contentPath: string;
	configPath: string;
	configExists: boolean;
	resolve: (path: string) => string;
};

export function resolveContentPaths(config: AstroConfig): ResolvedContentPaths {
	const contentPath = new URL('./content/', config.srcDir);

	const validConfigPaths = possibleConfigs.map((configPath) =>
		fileURLToPath(new URL(`./${configPath}`, config.srcDir))
	);

	const existingConfig = validConfigPaths.find((configPath) => existsSync(configPath));

	const configFile = existingConfig ?? validConfigPaths[0];

	return {
		projectRoot: fileURLToPath(config.root),
		contentPath: fileURLToPath(contentPath),
		configPath: configFile,
		configExists: existingConfig !== undefined,
		resolve: (path) => fileURLToPath(new URL(path, contentPath)),
	};
}
