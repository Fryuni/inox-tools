import type { PlopTypes } from '@turbo/gen';
import { kebabCase } from 'lodash';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export default (plop: PlopTypes.NodePlopAPI, { destBasePath }: PlopTypes.PlopCfg) => {
	plop.setGenerator('integration', {
		description: 'Generate a new integration',
		prompts: [
			{
				name: 'name',
				message: 'Integration name:',
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
				destination: '{{ turbo.paths.root }}/packages/{{ dashCase name }}',
				templateFiles: `${__dirname}/templates/**/*`,
				base: `${__dirname}/templates`,
				verbose: true,
			},
		],
	});
};
