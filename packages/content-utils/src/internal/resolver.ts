import type { AstroConfig } from 'astro';
import { createResolver } from 'astro-integration-kit';
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
	contentPath: string;
	configPath: string;
	configExists: boolean;
	resolve: ReturnType<typeof createResolver>['resolve'];
};

export function resolveContentPaths(config: AstroConfig): ResolvedContentPaths {
	const baseResolver = createResolver(fileURLToPath(config.srcDir));

	const contentPath = baseResolver.resolve('content');
	const resolver = createResolver(contentPath);

	const validConfigPaths = possibleConfigs.map((configPath) =>
		baseResolver.resolve(`${configPath}`)
	);

	const existingConfig = validConfigPaths.find((configPath) => existsSync(configPath));

	const configFile = existingConfig ?? validConfigPaths[0];

	return {
		contentPath,
		configPath: configFile,
		configExists: existingConfig !== undefined,
		resolve: resolver.resolve,
	};
}
