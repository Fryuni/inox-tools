import type { Plugin } from 'vite';
import { walk, type Node } from 'estree-walker';
import * as assert from 'node:assert';
import MagicString from 'magic-string';

export const entrypoints: string[] = [];

const INJECTOR_VIRTUAL_MODULE = '@it-astro:content/injector';
const RESOLVED_INJECTOR_VIRTUAL_MODULE = `\0${INJECTOR_VIRTUAL_MODULE}`;

const CONTENT_VIRTUAL_MODULE = '@it-astro:content';
const RESOLVED_CONTENT_VIRTUAL_MODULE = `\0${CONTENT_VIRTUAL_MODULE}`;

export const plugin = (configFile: string): Plugin => ({
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
				return [
					'export {defineCollection} from "@inox-tools/content-utils/runtime/fancyContent";',
					'export {z, reference} from "astro:content";',
				].join('\n');
		}
	},
	transform(code, id) {
		if (id !== configFile) return;

		const ast = this.parse(code);
		const s = new MagicString(code);

		function update(node: Node, updater: (code: string) => string) {
			assert.ok(isBryceNode(node), 'Ping Bryce, he lied!');

			const { start, end } = node;

			const oldCode = s.slice(start, end);
			const newCode = updater(oldCode);

			if (oldCode === newCode) return;

			s.update(start, end, newCode);
		}

		s.prepend(
			`import {injectCollections as $$inox_tools__injectCollection} from '@inox-tools/content-utils/runtime/injector';`
		);

		walk(ast, {
			enter(node, parent) {
				if (parent?.type !== 'ExportNamedDeclaration' || node.type !== 'VariableDeclaration')
					return;

				const collectionDeclaration = node.declarations.find((value) => {
					return value.id.type === 'Identifier' && value.id.name === 'collections';
				});

				// TODO: Maybe this should be an error.
				if (collectionDeclaration?.init == null) return;

				const sourceInit = collectionDeclaration.init;

				update(sourceInit, (code) => `$$inox_tools__injectCollection(${code})`);
			},
		});

		console.log('Transformed code:\n', s.toString());

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
