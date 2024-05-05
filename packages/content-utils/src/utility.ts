import { Once } from '@inox-tools/utils/once';
import {
	addVitePlugin,
	createResolver,
	defineUtility,
	type HookParameters,
} from 'astro-integration-kit';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { plugin, entrypoints } from './plugin.js';
import { fileURLToPath } from 'url';

// TODO: Reorganize this files, this looks like a dumpster

export type Options = {
	entrypoint: string;
};

const possibleConfigs = ['config.mjs', 'config.js', 'config.mts', 'config.ts'];
const installPluginOnce = new Once();

export const injectContent = defineUtility('astro:config:setup')((
	params: HookParameters<'astro:config:setup'>,
	options: Options
) => {
	const resolver = createResolver(fileURLToPath(params.config.srcDir));

	const existingConfig = possibleConfigs
		.map((configPath) => resolver.resolve(`content/${configPath}`))
		.find((configPath) => existsSync(configPath));

	const configFile = existingConfig ?? resolver.resolve('content/config.ts');

	if (existingConfig === undefined) {
		mkdirSync(resolver.resolve('content'), { recursive: true });
		writeFileSync(configFile, 'export const collections = {};');
	}

	installPluginOnce.do(() => {
		addVitePlugin(params, {
			plugin: plugin(configFile),
			warnDuplicated: true,
		});
	});

	entrypoints.push(options.entrypoint);
});
