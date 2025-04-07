import { defineIntegration, addVitePlugin, createResolver } from 'astro-integration-kit';
import type { AstNode, TransformPluginContext } from 'rollup';
import { walk, type Node as ETreeNode } from 'estree-walker';
import MagicString, { type SourceMap } from 'magic-string';
import { z } from 'astro/zod';
import { debug } from './internal/debug.js';
import { AstroError } from 'astro/errors';

type ParseNode = ETreeNode & AstNode;

const { resolve } = createResolver(import.meta.url);

export default defineIntegration({
	name: '@inox-tools/cut-short',
	optionsSchema: z
		.object({
			disableStreaming: z.boolean().default(false),
		})
		.default({}),
	setup({ options }) {
		return {
			hooks: {
				'astro:config:setup': (params) => {
					params.addMiddleware({
						entrypoint: options.disableStreaming
							? resolve('./runtime/holdMiddleware.js')
							: resolve('./runtime/middleware.js'),
						order: 'post',
					});

					addVitePlugin(params, {
						warnDuplicated: true,
						plugin: {
							name: '@inox-tools/cut-short',
							enforce: 'pre',
							resolveId(source) {
								if (source === '@it-astro:cut-short') {
									return resolve('./runtime/entrypoint.js');
								}
							},
							async transform(code, id, { ssr } = {}) {
								if (!ssr) return;

								const transformers: (Transformer | false)[] = [
									options.disableStreaming && createComponentTransformer,
								];

								for (const transformer of transformers) {
									if (!transformer) continue;
									const result = transformer(this, code, id);
									if (result) return result;
								}

								return;
							},
						},
					});
				},
				'astro:config:done': (params) => {
					// Check if the version of Astro being used has the `injectTypes` utility.
					if (typeof params.injectTypes === 'function') {
						debug('Injecting types in .astro structure');
						params.injectTypes({
							filename: 'types.d.ts',
							content: "import '@inox-tools/cut-short';",
						});
					}
				},
			},
		};
	},
});

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

	walk(ast, {
		leave(estreeNode, parent) {
			const node = estreeNode as ParseNode;
			if (node.type !== 'FunctionDeclaration') return;
			if (node.id.name !== 'createComponent') return;
			if (parent?.type !== 'Program') {
				throw new AstroError(
					'"@inox-tools/cut-short" cannot handle responses from nested components with the installed Astro version.',
					'Please open an issue on https://github.com/Fryuni/inox-tools/issues/new'
				);
			}

			ms.prependLeft(
				node.start,
				[
					`import {wrapCreateComponent as $$createComponent} from ${JSON.stringify(resolve('./runtime/nestedComponentWrapper.js'))};`,
					'const createComponent = $$createComponent(',
				].join('\n')
			);
			ms.appendRight(node.end, ');');
		},
	});

	return {
		code: ms.toString(),
		map: ms.generateMap(),
	};
};
