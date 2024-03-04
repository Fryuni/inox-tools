import * as recast from 'recast';
import * as parser from 'recast/parsers/typescript.js';
import * as path from 'node:path';
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

function hoistImport(importPath: string, modName: string, code: string): TransformResult | null {
	let ast: ReturnType<typeof parser.parse>;
	try {
		ast = recast.parse(code, {
			sourceFileName: modName,
			parser: {
				parse(code: string) {
					return parser.parse(code, {
						sourceType: 'module',
						strictMode: true,
					});
				},
			},
		});
	} catch (e) {
		console.log('Error on parsing:', e);
		console.log('Code:', code);
		throw e;
	}

	let found: string | null = null;
	let astroNode: any;

	recast.visit(ast, {
		visitImportDeclaration(path) {
			if (path.node.source.type === 'StringLiteral' && path.node.source.value === importPath) {
				const defaultSpecifier = path.node.specifiers?.find(
					(specifier) => specifier.type === 'ImportDefaultSpecifier'
				);
				const defaultImport = defaultSpecifier?.local?.name?.toString();
				found = defaultImport!;
			}

			return false;
		},
		visitVariableDeclaration(path) {
			if (!found) return false;

			if (path.node.kind === 'const') {
				const declarator = path.node.declarations.find(
					(declarator) =>
						declarator.type === 'VariableDeclarator' &&
						declarator.id.type === 'Identifier' &&
						declarator.id.name === '$$Astro'
				);
				if (declarator) {
					astroNode = path;
				}
				return this.traverse(path);
			}
		},
		visitExpressionStatement(path) {
			if (!found) return false;

			if (path.node.expression.type !== 'CallExpression') return this.traverse(path);

			if (
				path.node.expression.callee.type !== 'Identifier' ||
				path.node.expression.callee.name !== found
			)
				return this.traverse(path);

			path
				.get('expression', 'arguments')
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
						b.objectProperty(b.identifier('sourceFile'), b.stringLiteral(modName)),
					])
				);

			// Hoist it
			astroNode.insertAfter(path.node);
			// Remove original
			path.replace();
			return false;
		},
	});

	if (!found) return null;

	const newCode = recast.print(ast, { sourceFileName: modName, sourceMapName: 'foo' });

	return {
		code: newCode.code,
		map: {
			mappings: newCode.map!.mappings,
		},
	};
}
