/**
 * Copied from Astro for same code style as the official packages.
 *
 * @see https://github.com/withastro/astro/blob/24663c9695385fed9ece57bf4aecdca3a8581e70/prettier.config.js
 */

/** @type {import("prettier").Config} */
export default {
	printWidth: 100,
	semi: true,
	singleQuote: true,
	tabWidth: 2,
	trailingComma: 'es5',
	useTabs: true,
	plugins: ['prettier-plugin-astro'],
	overrides: [
		{
			files: ['.*', '*.json', '*.md', '*.toml', '*.yml'],
			options: {
				useTabs: false,
			},
		},
		{
			files: ['**/*.astro'],
			options: {
				parser: 'astro',
			},
		},
	],
};
