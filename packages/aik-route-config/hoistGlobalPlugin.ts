import * as recast from 'recast';
import * as parser from 'recast/parsers/typescript.js';
import type { Plugin, TransformResult } from 'vite';

const b = recast.types.builders;

type HoistGlobalOptions = {
	configImport: string;
};

export function hoistGlobalPlugin(options: HoistGlobalOptions): Plugin {
	const resolvedId = '\x00' + options.configImport;

	return {
		name: `@inox-tools/aik-route-config/${options.configImport}`,
		resolveId(id) {
			if (id === options.configImport) {
				return resolvedId;
			}
		},
		load(id) {
			if (id === resolvedId) {
				return `
        export default function(context, cb) {
          globalThis[Symbol.for('@inox-tools/aik-route-config')]?.get('${options.configImport}')?.(context, cb);
        }`;
			}
		},
		transform(code, id) {
			if (id.endsWith('.astro')) {
				return hoistImport(options.configImport, id, code);
			}
		},
	};
}

/** @internal */
export function hoistImport(magicImport: string, currentModule: string, code: string): TransformResult | null {
	let ast: ReturnType<typeof parser.parse>;
	try {
		ast = recast.parse(code, {
			sourceFileName: currentModule,
			parser: {
				parse(_code: string) {
					return parser.parse(_code, {
						sourceType: 'module',
						strictMode: false,
					});
				},
			},
		});
	} catch (e) {
		/* eslint-disable no-console */
		console.log('Error on parsing:', e);
		console.log('Code:', code);
		/* eslint-enable no-console */
		throw e;
	}

	let found: string[] = [];
	let astroNode: any;

	recast.visit(ast, {
		visitImportDeclaration(path) {
			if (path.node.source.type === 'StringLiteral' && path.node.source.value === magicImport) {
				const defaultSpecifier = path.node.specifiers?.find(
					(specifier) => specifier.type === 'ImportDefaultSpecifier'
				);
				const defaultImport = defaultSpecifier?.local?.name?.toString();
				if (defaultImport) {
					found.push(defaultImport);
				}
			}

			return this.traverse(path);
		},
		visitVariableDeclaration(path) {
			if (!found.length) return false;

			if (path.node.kind === 'const') {
				const declaration = path.node.declarations.find(
					(decl) =>
						decl.type === 'VariableDeclarator' &&
						decl.id.type === 'Identifier' &&
						decl.id.name === '$$Astro'
				);
				if (declaration) {
					astroNode = path;
				}
				return this.traverse(path);
			}
		},
		visitExpressionStatement(path) {
			if (!found.length) return false;

			let exprPath = path.get('expression');
			let expression = path.node.expression;

			if (expression.type === 'AwaitExpression' && expression.argument?.type === 'CallExpression') {
				exprPath = exprPath.get('argument');
				expression = expression.argument;
			}

			if (expression.type !== 'CallExpression') return this.traverse(path);

			if (
				expression.callee.type !== 'Identifier' ||
				!found.includes(expression.callee.name)
			)
				return this.traverse(path);

			exprPath
				.get('arguments')
				.insertAt(
					0,
					b.objectExpression([
						b.objectProperty(
							b.identifier('bundleFile'),
							b.memberExpression(
								b.memberExpression(b.identifier('import'), b.identifier('meta')),
								b.identifier('url')
							)
						),
						b.objectProperty(b.identifier('sourceFile'), b.stringLiteral(currentModule)),
					])
				);

			// Hoist it
			astroNode.insertAfter(b.expressionStatement(b.awaitExpression(expression)));
			// Remove original
			path.replace();
			return false;
		},
	});

	if (!found.length) return null;

	const newCode = recast.print(ast, { sourceFileName: currentModule, sourceMapName: 'foo' });

	return {
		code: newCode.code,
		map: {
			mappings: newCode.map!.mappings,
		},
	};
}
