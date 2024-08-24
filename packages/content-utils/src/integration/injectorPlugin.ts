import type { Plugin } from 'vite';
import { walk, type Node } from 'estree-walker';
import * as assert from 'node:assert';
import MagicString from 'magic-string';
import { AstroError } from 'astro/errors';
import type { IntegrationState } from './state.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getDebug } from '../internal/debug.js';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);

const INJECTOR_VIRTUAL_MODULE = '@it-astro:content/injector';
const RESOLVED_INJECTOR_VIRTUAL_MODULE = `\0${INJECTOR_VIRTUAL_MODULE}`;

const CONTENT_VIRTUAL_MODULE = '@it-astro:content';
const RESOLVED_CONTENT_VIRTUAL_MODULE = `\0${CONTENT_VIRTUAL_MODULE}`;

const debug = getDebug('injector-plugin');

export const injectorPlugin = ({
	logger,
	injectedCollectionsEntrypoints: entrypoints,
	contentPaths: { configPath: configFile },
}: IntegrationState): Plugin => ({
	name: '@inox-tools/content-utils/injector',
	resolveId(id) {
		switch (id) {
			case INJECTOR_VIRTUAL_MODULE:
				return RESOLVED_INJECTOR_VIRTUAL_MODULE;
			case CONTENT_VIRTUAL_MODULE:
				return RESOLVED_CONTENT_VIRTUAL_MODULE;
		}
	},
	load(id) {
		switch (id) {
			case RESOLVED_INJECTOR_VIRTUAL_MODULE:
				debug('Generating injected collection modole from:', entrypoints);
				return [
					...entrypoints.map(
						(entrypoint, index) =>
							`import {collections as __collections${index}} from '${entrypoint}';`
					),
					'export const injectedCollections = {',
					...entrypoints.map((_, index) => `...__collections${index},`),
					'};',
				].join('\n');
			case RESOLVED_CONTENT_VIRTUAL_MODULE:
				debug('Generating fancy content module');
				return [
					`export {defineCollection} from ${JSON.stringify(resolve(thisDir, 'runtime/fancyContent.js'))};`,
					'export {z, reference} from "astro:content";',
				].join('\n');
		}
	},
	transform(code, id) {
		if (id !== configFile) return;

		debug('Transforming config file');

		const ast = this.parse(code);
		const s = new MagicString(code);

		function update(node: Node, updater: (code: string) => string) {
			assert.ok(isBryceNode(node), 'Ping Bryce, he lied!');

			const { start, end } = node;

			const oldCode = s.slice(start, end);
			const newCode = updater(oldCode);

			if (oldCode === newCode) {
				debug('Code is unnafected by transformation.');
				return;
			}

			s.update(start, end, newCode);
		}

		debug('Adding import for collection injection runtime');
		// This imports the collection injection under a name unconditionally because the plugin is never injected
		// more than once. If this guarantee changes, this line would require some logic to ensure a unique identifier.
		s.prepend(
			`import {injectCollections as $$inox_tools__injectCollection} from ${JSON.stringify(resolve(thisDir, 'runtime/injector.js'))};`
		);

		walk(ast, {
			enter(node, parent) {
				if (parent?.type !== 'ExportNamedDeclaration' || node.type !== 'VariableDeclaration')
					return;

				const collectionDeclaration = node.declarations.find((value) => {
					return value.id.type === 'Identifier' && value.id.name === 'collections';
				});

				if (collectionDeclaration?.init == null) {
					throw new AstroError(
						'Exported collections is not initialized.',
						`Change your ${configFile} to initialize the value of "collections".`
					);
				}

				if (node.kind !== 'const') {
					logger.warn(
						'Exporting collections config using "let" may have unintended consequences. ' +
							`Prefer "export const collections" in your "${configFile}".`
					);
				}

				const sourceInit = collectionDeclaration.init;

				debug('Wrapping collection definition with collection injection');
				update(sourceInit, (code) => `$$inox_tools__injectCollection(${code})`);
			},
		});

		return {
			code: s.toString(),
			map: s.generateMap(),
		};
	},
});

type BryceNode = Node & {
	start: number;
	end: number;
};

// Bryce said this always happens
function isBryceNode(node: Node): node is BryceNode {
	return typeof (node as any).start === 'number' && typeof (node as any).end === 'number';
}
