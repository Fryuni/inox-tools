import type { PlopTypes } from '@turbo/gen';

Object.assign(
	console,
	new console.Console({
		stdout: process.stdout,
		stderr: process.stderr,
		inspectOptions: {
			colors: true,
			depth: 4,
		},
	})
);

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	plop.load('./astro-integration/index.ts');
}
