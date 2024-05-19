import * as assert from 'assert';
import type { NodePath } from 'ast-types/lib/node-path.js';
import type { Context } from 'ast-types/lib/path-visitor.js';
import type { AstroIntegrationLogger } from 'astro';
import * as recast from 'recast';
import * as parser from 'recast/parsers/typescript.js';
import type { Plugin, TransformResult } from 'vite';

const b = recast.types.builders;

type HoistGlobalOptions = {
	configImport: string;
	logger: AstroIntegrationLogger;
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
				return hoistImport({
					logger: options.logger,
					magicImport: options.configImport,
					currentModule: id,
					code,
				});
			}
		},
	};
}

type HoistOptions = {
	magicImport: string;
	currentModule: string;
	code: string;
	logger: AstroIntegrationLogger;
};

/** @internal */
export function hoistImport({
	magicImport,
	currentModule,
	code,
	logger,
}: HoistOptions): TransformResult | null {
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
		logger.error(`Error on parsing: ${e}`);
		logger.error(`Code: ${code}`);
		throw e;
	}

	const visitor = makeVisitor(magicImport, currentModule, logger);
	recast.visit(ast, visitor);

	if (visitor.state.phase === VisitorPhase.Cancelled) return null;

	const newCode = recast.print(ast, { sourceFileName: currentModule, sourceMapName: 'foo' });

	return {
		code: newCode.code,
		map: {
			mappings: newCode.map!.mappings,
		},
	};
}

enum VisitorPhase {
	Initializing = 'Initializing',
	Initialized = 'Initialized',
	Cancelled = 'Cancelled',
	HoistingCalls = 'HoistingCalls',
	EnrichingCallsInPlace = 'EnrichingCallsInPlace',
	DroppingCalls = 'DroppingCalls',
}

interface Visitor extends recast.types.Visitor<Visitor> {
	state: {
		foundNames: string[];
		astroNode?: NodePath<recast.types.namedTypes.VariableDeclaration>;
		phase: VisitorPhase;
	};
	warnUnexpectedStructure(this: Context & Visitor, message: string): void;
	traverseWithState(this: Context & Visitor, state: VisitorPhase, path: NodePath): void;
}

function makeVisitor(
	magicImport: string,
	currentModule: string,
	logger: AstroIntegrationLogger
): Visitor {
	return {
		state: {
			foundNames: [],
			phase: VisitorPhase.Initializing,
		},
		warnUnexpectedStructure(message) {
			logger.warn(`Detected Astro module with unexpected structure. Module "${currentModule}" ${message}.
Please send a report on https://github.com/Fryuni/inox-tools/issues/new with the module for reproduction`);
		},
		traverseWithState(state: VisitorPhase, path: NodePath) {
			const prevState = this.state.phase;
			this.state.phase = state;
			try {
				return this.traverse(path);
			} finally {
				this.state.phase = prevState;
			}
		},
		visitImportDeclaration(path) {
			// Imports that come after the initialization are not relevant
			if (this.state.phase !== VisitorPhase.Initializing) return false;

			if (path.node.source.type === 'StringLiteral' && path.node.source.value === magicImport) {
				const defaultSpecifier = path.node.specifiers?.find(
					(specifier) => specifier.type === 'ImportDefaultSpecifier'
				);
				const defaultImport = defaultSpecifier?.local?.name?.toString();
				if (defaultImport) {
					this.state.foundNames.push(defaultImport);
				}
			}

			return this.traverse(path);
		},
		visitVariableDeclaration(path) {
			if (this.state.astroNode === undefined && path.node.kind === 'const') {
				const declaration = path.node.declarations.find(
					(decl) =>
						(decl.type === 'VariableDeclarator' &&
							decl.id.type === 'Identifier' &&
							decl.id.name === 'Astro') ||
						(decl.type === 'VariableDeclarator' &&
							decl.init?.type === 'CallExpression' &&
							decl.init.callee.type === 'Identifier' &&
							decl.init.callee.name === '$$createComponent')
				);
				if (declaration) {
					if (this.state.foundNames.length === 0) {
						this.state.phase = VisitorPhase.Cancelled;
						this.abort();
						return;
					}
					this.state.astroNode = path;
					this.state.phase = VisitorPhase.Initialized;
				}
			}

			this.traverse(path);
		},
		visitCallExpression(path) {
			if (path.node.callee.type !== 'Identifier') {
				this.traverse(path);
				return;
			}

			if (path.node.callee.name === '$$createComponent') {
				switch (this.state.phase) {
					case VisitorPhase.Initializing:
					case VisitorPhase.Initialized:
						this.traverseWithState(VisitorPhase.HoistingCalls, path);
						return;
					case VisitorPhase.Cancelled:
						assert.fail('Hoisting continued after abortion.');
					case VisitorPhase.HoistingCalls:
						this.warnUnexpectedStructure('has nested $$createComponent declarations');
						return false;
					case VisitorPhase.EnrichingCallsInPlace:
					case VisitorPhase.DroppingCalls:
						this.warnUnexpectedStructure('has more than one $$createComponent declarations');
						return false;
				}
			}

			if (this.state.foundNames.includes(path.node.callee.name)) {
				switch (this.state.phase) {
					case VisitorPhase.HoistingCalls:
					case VisitorPhase.EnrichingCallsInPlace:
					case VisitorPhase.Initialized: {
						path
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

						this.traverseWithState(VisitorPhase.EnrichingCallsInPlace, path);
						return;
					}
					case VisitorPhase.DroppingCalls: {
						return b.unaryExpression('void', b.numericLiteral(0));
					}
					default: {
						assert.fail('Unexpected phase for call expression');
					}
				}
			} else {
			}

			this.traverse(path);
		},
		visitFunctionDeclaration(path) {
			switch (this.state.phase) {
				case VisitorPhase.HoistingCalls:
					this.traverseWithState(VisitorPhase.DroppingCalls, path);
					break;
				case VisitorPhase.Initializing:
					this.state.phase = VisitorPhase.Initialized;
				default:
					this.traverse(path);
			}
		},
		visitExpressionStatement(path) {
			this.traverse(path);

			if (this.state.phase !== VisitorPhase.HoistingCalls) {
				return;
			}

			let expression = path.node.expression;

			if (expression.type === 'AwaitExpression' && expression.argument?.type === 'CallExpression') {
				expression = expression.argument;
			}

			if (
				expression.type === 'CallExpression' &&
				expression.callee.type === 'Identifier' &&
				this.state.foundNames.includes(expression.callee.name)
			) {
				// Hoist it
				this.state.astroNode!.insertBefore(b.expressionStatement(b.awaitExpression(expression)));
				// Remove original
				path.replace();
			}
		},
	};
}
