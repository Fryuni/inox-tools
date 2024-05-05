import type { AstroConfig } from 'astro';
import { createResolver } from 'astro-integration-kit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// https://github.com/withastro/astro/blob/fd508a0f/packages/astro/src/content/utils.ts#L456
const possibleConfigs = ['config.mjs', 'config.js', 'config.mts', 'config.ts'];

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

	const existingConfig = possibleConfigs
		.map((configPath) => resolver.resolve(`${configPath}`))
		.find((configPath) => existsSync(configPath));

	const configFile = existingConfig ?? resolver.resolve('config.ts');

	return {
		contentPath,
		configPath: configFile,
		configExists: existingConfig !== undefined,
		resolve: resolver.resolve,
	};
}
