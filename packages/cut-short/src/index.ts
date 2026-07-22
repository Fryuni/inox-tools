import type { Plugin } from 'vite';
import MagicString, { type SourceMap } from 'magic-string';
import { debug } from './internal/debug.js';
import { AstroError } from 'astro/errors';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

type ParsedAstNode = {
	type: string;
	start: number;
	end: number;
	[key: string]: unknown;
};

export default function cutShort({
	disableStreaming = false,
}: { disableStreaming?: boolean } = {}): AstroIntegration {
	const { prerenderStopMark } = ((globalThis as any)[Symbol.for('@it/cut-short')] = {
		prerenderStopMark: randomUUID(),
	});

	return {
		name: '@inox-tools/cut-short',
		hooks: {
			'astro:config:setup': (params) => {
				params.addMiddleware({
					entrypoint: new URL(
						disableStreaming ? './runtime/holdMiddleware.js' : './runtime/middleware.js',
						import.meta.url
					),
					order: 'post',
				});

				params.updateConfig({
					vite: {
						plugins: [
							{
								name: '@inox-tools/cut-short',
								enforce: 'pre',
								resolveId(source) {
									if (source === '@it-astro:cut-short') {
										return fileURLToPath(new URL('./runtime/entrypoint.js', import.meta.url));
									}
								},
								async transform(code, id, options) {
									if (!options?.ssr) return;

									const transformers: (Transformer | false)[] = [
										disableStreaming && createComponentTransformer,
									];

									for (const transformer of transformers) {
										if (!transformer) continue;
										const result = transformer(this, code, id);
										if (result) return result;
									}

									return;
								},
							},
						],
					},
				});
			},
			'astro:config:done': (params) => {
				debug('Injecting types in .astro structure');
				params.injectTypes({
					filename: 'types.d.ts',
					content: "import '@inox-tools/cut-short';",
				});
			},
			'astro:build:done': async ({ assets, logger }) => {
				const pairs = Array.from(assets.entries());

				const foldersToClean = new Set<string>();

				await Promise.all(
					pairs.map(async ([key, urls]) => {
						for (const url of urls) {
							try {
								const fileContent = await fs.readFile(url, 'utf-8');
								if (fileContent.trim() === prerenderStopMark) {
									await fs.unlink(url);
									assets.delete(key);
									foldersToClean.add(path.dirname(fileURLToPath(url)));
								}
							} catch (error) {
								console.error(`Failed to process asset at ${url}:`, error);
							}
						}
					})
				);

				while (true) {
					const { value: folder } = foldersToClean.values().next();
					if (folder === undefined) break;
					foldersToClean.delete(folder);

					try {
						const children = await fs.readdir(folder, { encoding: null });
						if (children.length === 0) {
							await fs.rmdir(folder);
							foldersToClean.add(path.dirname(folder));
						}
					} catch (error) {
						logger.error(`Failed to clear empty directory ${folder}: ${error}`);
					}
				}
			},
		},
	};
}

type TransformPluginContext = ThisParameterType<
	Extract<NonNullable<Plugin['transform']>, (...args: never[]) => unknown>
>;

type Transformer = (
	ctx: TransformPluginContext,
	code: string,
	id: string
) => TransformResult | null;

type TransformResult = {
	code: string;
	map: SourceMap;
};

const createComponentTransformer: Transformer = (ctx, code, id) => {
	if (!code.includes('function createComponent(')) return null;

	if (!/node_modules\/astro\/dist\/runtime\/[\w\/.-]+\.js/.test(id)) {
		debug('"createComponent" declaration outside of expected module', { id });
		return null;
	}

	const ms = new MagicString(code);
	const ast = ctx.parse(code);

	visitAst(ast, null, (node, parent) => {
		if (!isCreateComponentDeclaration(node)) return;
		if (parent?.type !== 'Program') {
			throw new AstroError(
				'"@inox-tools/cut-short" cannot handle responses from nested components with the installed Astro version.',
				'Please open an issue on https://github.com/Fryuni/inox-tools/issues/new'
			);
		}

		ms.prependLeft(
			node.start,
			[
				`import {wrapCreateComponent as $$createComponent} from ${JSON.stringify(fileURLToPath(new URL('./runtime/nestedComponentWrapper.js', import.meta.url)))};`,
				'const createComponent = $$createComponent(',
			].join('\n')
		);
		ms.appendRight(node.end, ');');
	});

	return {
		code: ms.toString(),
		map: ms.generateMap(),
	};
};

function visitAst(
	value: unknown,
	parent: ParsedAstNode | null,
	visitor: (node: ParsedAstNode, parent: ParsedAstNode | null) => void
): void {
	if (!isParsedAstNode(value)) return;

	for (const key in value) {
		if (key === 'parent') continue;

		const child = value[key];
		if (Array.isArray(child)) {
			for (const item of child) visitAst(item, value, visitor);
		} else {
			visitAst(child, value, visitor);
		}
	}

	visitor(value, parent);
}

function isParsedAstNode(value: unknown): value is ParsedAstNode {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		typeof value.type === 'string' &&
		'start' in value &&
		typeof value.start === 'number' &&
		'end' in value &&
		typeof value.end === 'number'
	);
}

function isCreateComponentDeclaration(
	node: ParsedAstNode
): node is ParsedAstNode & { type: 'FunctionDeclaration'; id: { name: string } } {
	return (
		node.type === 'FunctionDeclaration' &&
		typeof node.id === 'object' &&
		node.id !== null &&
		'name' in node.id &&
		typeof node.id.name === 'string' &&
		node.id.name === 'createComponent'
	);
}
