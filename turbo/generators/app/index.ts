import { kebabCase } from 'lodash';
import type { PlopTypes } from '@turbo/gen';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export default (plop: PlopTypes.NodePlopAPI, { destBasePath }: PlopTypes.PlopCfg) => {
	plop.setGenerator('vite-plugin', {
		description: 'Generate a new Vite plugin',
		prompts: [
			{
				name: 'name',
				message: 'Plugin Name:',
				validate: async (name) => {
					const packageJsonPath = path.join(
						destBasePath,
						'packages',
						kebabCase(name),
						'package.json'
					);

					try {
						await fs.lstat(packageJsonPath);

						return `Package ${name} already exists`;
					} catch {
						return true;
					}
				},
			},
			{
				name: 'description',
				message: 'Description:',
				filter: (desc) => desc || undefined,
				transformer: (desc) => desc || '<empty>',
			},
		],
		actions: [
			{
				type: 'addMany',
				destination: '{{ turbo.paths.root }}/packages/{{ name }}',
				templateFiles: `${__dirname}/templates/**/*`,
				base: `${__dirname}/templates`,
				verbose: true,
			},
		],
	});
};
