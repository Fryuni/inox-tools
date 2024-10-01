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
			{
				name: 'hasRuntime',
				message: 'Has runtime exports?',
				type: 'confirm',
			},
			{
				name: 'hasLib',
				message: 'Has library exports?',
				type: 'confirm',
			},
		],
		actions: (ans) => {
			const actions: PlopTypes.Actions = [
				{
					type: 'addMany',
					destination: '{{ turbo.paths.root }}/packages/{{ dashCase name }}',
					templateFiles: `${__dirname}/templates/**/*`,
					base: `${__dirname}/templates`,
					verbose: true,
				},
				{
					type: 'modify',
					path: '{{ turbo.paths.root }}/.github/labeler.yml',
					pattern: '## PACKAGES',
					template: `
## PACKAGES

pkg/{{ dashCase name }}:
- 'packages/{{ dashCase name }}/**'
`.trim(),
				},
			];

			if (ans?.hasLib) {
				actions.push({
					type: 'add',
					path: '{{ turbo.paths.root }}/packages/{{ dashCase name }}/src/lib/sample.ts',
					template: '// This is a sample lib file\n// Users will import this module directly',
					skipIfExists: true,
				});
			}

			if (ans?.hasRuntime) {
				actions.push({
					type: 'add',
					path: '{{ turbo.paths.root }}/packages/{{ dashCase name }}/src/runtime/sample.ts',
					template: '// This is a sample runtime file\n// It will be imported by Astro',
					skipIfExists: true,
				});
			}

			return actions;
		},
	});
};
