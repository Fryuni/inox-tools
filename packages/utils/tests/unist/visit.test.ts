import * as assert from 'node:assert/strict';
import { test } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { EXIT, SKIP, CONTINUE, visitParents } from '../../src/unist/visit.js';
import type { Parents, PhrasingContent } from 'mdast';

const tree = fromMarkdown('Some _emphasis_, **importance**, and `code`.');

const paragraph = tree.children[0];
assert.ok(paragraph.type === 'paragraph');
const emphasis = paragraph.children[1];
assert.ok(emphasis.type === 'emphasis');
const strong = paragraph.children[3];
assert.ok(strong.type === 'strong');

const textNodes = 6;

const stopIndex = 5;
const skipIndex = 7;
const skipReverseIndex = 6;

const types = [
	'root', // []
	'paragraph', // [tree]
	'text', // [tree, paragraph]
	'emphasis', // [tree, paragraph]
	'text', // [tree, paragraph, emphasis]
	'text', // [tree, paragraph]
	'strong', // [tree, paragraph]
	'text', // [tree, paragraph, strong]
	'text', // [tree, paragraph]
	'inlineCode', // [tree, paragraph]
	'text', // [tree, paragraph]
];

const reverseTypes = [
	'root',
	'paragraph',
	'text',
	'inlineCode',
	'text',
	'strong',
	'text',
	'text',
	'emphasis',
	'text',
	'text',
];

const ancestors: Array<Array<Parents>> = [
	[],
	[tree],
	[tree, paragraph],
	[tree, paragraph],
	[tree, paragraph, emphasis],
	[tree, paragraph],
	[tree, paragraph],
	[tree, paragraph, strong],
	[tree, paragraph],
	[tree, paragraph],
	[tree, paragraph],
];

const textAncestors: Array<Array<Parents>> = [
	[tree, paragraph],
	[tree, paragraph, emphasis],
	[tree, paragraph],
	[tree, paragraph, strong],
	[tree, paragraph],
	[tree, paragraph],
];

test('should expose the public api', async function () {
	assert.deepEqual(Object.keys(await import('../../src/unist/visit.js')).sort(), [
		'CONTINUE',
		'EXIT',
		'SKIP',
		'visitParents',
	]);
});

test('should fail without tree', async function () {
	assert.throws(function () {
		// @ts-expect-error: check that the runtime throws an error.
		visitParents({});
	}, 'Error: A tree is required');
});

test('should fail without visitor', async function () {
	assert.throws(function () {
		visitParents({ tree });
	}, 'Error: At least one visitor (`enter` or `leave`) must be provided');
});

test('should iterate over all nodes', function () {
	let n = 0;

	visitParents({
		tree,
		enter: function (node, parents) {
			assert.strictEqual(node.type, types[n], 'should be the expected type');
			assert.deepStrictEqual(parents, ancestors[n], 'should have expected parents');
			n++;
		},
	});

	assert.equal(n, types.length, 'should visit all nodes');
});

test('should iterate over all nodes, backwards', function () {
	let n = 0;

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, reverseTypes[n], 'should be the expected type');
			n++;
		},
		reverse: true,
	});

	assert.equal(n, reverseTypes.length, 'should visit all nodes in reverse');
});

test('should only visit a given `type`', function () {
	let n = 0;

	visitParents({
		tree,
		test: 'text',
		enter: function (node, parents) {
			assert.strictEqual(node.type, 'text');
			assert.deepStrictEqual(parents, textAncestors[n]);
			n++;
		},
	});

	assert.equal(n, textNodes, 'should visit all nodes');
});

test('should only visit a given fields with proper type narrowing', function () {
	let n = 0;

	visitParents({
		tree,
		test: { type: 'text' },
		enter: function (node, parents) {
			assert.strictEqual(node.type, 'text');
			assert.deepStrictEqual(parents, textAncestors[n]);
			n++;
		},
	});

	assert.equal(n, textNodes, 'should visit all nodes');
});

test('should only visit given `type`s', function () {
	const types = ['text', 'inlineCode'];
	let n = 0;

	visitParents({
		tree,
		test: types,
		enter: function (node) {
			assert.notStrictEqual(types.indexOf(node.type), -1, 'should match');
			n++;
		},
	});

	assert.equal(n, 7, 'should visit all matching nodes');
});

test('should accept any `is`-compatible test function', function () {
	let n = 0;
	const nodes: Array<PhrasingContent> = [
		paragraph.children[4],
		paragraph.children[5],
		paragraph.children[6],
	];

	visitParents({
		tree,
		test: function (_, index) {
			return typeof index === 'number' && index > 3;
		},
		enter: function (node, parents) {
			const parent = parents[parents.length - 1];
			// @ts-expect-error: `node` can always be inside parent.
			const index = parent ? parent.children.indexOf(node) : undefined;
			const info = '(' + (parent && parent.type) + ':' + index + ')';
			assert.strictEqual(node, nodes[n], 'should be a requested node ' + info);
			n++;
		},
	});

	assert.equal(n, 3, 'should visit all passing nodes');
});

test('should accept an array of `is`-compatible tests', function () {
	const expected = new Set(['root', 'paragraph', 'emphasis', 'strong']);
	let n = 0;

	visitParents({
		tree,
		test: [
			function (node) {
				return node.type === 'root';
			},
			'paragraph',
			{ value: '.' },
			'emphasis',
			'strong',
		],
		enter: function (node) {
			const ok = expected.has(node.type) || ('value' in node && node.value === '.');
			assert.ok(ok, 'should be a requested type: ' + node.type);
			n++;
		},
	});

	assert.equal(n, 5, 'should visit all passing nodes');
});

test('should stop if enter `visitor` stops', function () {
	let n = -1;

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, types[++n]);
			return n === stopIndex ? EXIT : CONTINUE;
		},
	});

	assert.equal(n, stopIndex, 'should visit nodes until `EXIT` is given');
});

test('should stop if leave `visitor` stops', function () {
	let n = -1;

	visitParents({
		tree,
		leave: function () {
			return ++n === stopIndex ? EXIT : CONTINUE;
		},
	});

	assert.equal(n, stopIndex, 'should visit nodes until `EXIT` is given');
});

test('should stop if enter `visitor` stops (tuple)', function () {
	let n = -1;

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, types[++n]);
			return [n === stopIndex ? EXIT : CONTINUE];
		},
	});

	assert.equal(n, stopIndex, 'should visit nodes until `EXIT` is given');
});

test('should stop if enter `visitor` stops, backwards', function () {
	let n = 0;

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, reverseTypes[n++], 'should be the expected type');
			return n === stopIndex ? EXIT : CONTINUE;
		},
		reverse: true,
	});

	assert.equal(n, stopIndex, 'should visit nodes until `EXIT` is given');
});

test('should skip if enter `visitor` skips', function () {
	let n = 0;
	let count = 0;

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, types[n++], 'should be the expected type');
			count++;

			if (n === skipIndex) {
				n++; // The one node inside it.
				return SKIP;
			}
		},
	});

	assert.equal(count, types.length - 1, 'should visit nodes except when `SKIP` is given');
});

test('should skip if enter `visitor` skips (tuple)', function () {
	let n = 0;
	let count = 0;

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, types[n++], 'should be the expected type');
			count++;

			if (n === skipIndex) {
				n++; // The one node inside it.
				return [SKIP];
			}
		},
	});

	assert.equal(count, types.length - 1, 'should visit nodes except when `SKIP` is given');
});

test('should skip if enter `visitor` skips, backwards', function () {
	let n = 0;
	let count = 0;

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, reverseTypes[n++], 'should be the expected type');
			count++;

			if (n === skipReverseIndex) {
				n++; // The one node inside it.
				return SKIP;
			}
		},
		reverse: true,
	});

	assert.equal(count, reverseTypes.length - 1, 'should visit nodes except when `SKIP` is given');
});

test('should support a given `index` to iterate over next (`0` to reiterate)', function () {
	let n = 0;
	let again = false;
	const expected = [
		'root',
		'paragraph',
		'text',
		'emphasis',
		'text',
		'text',
		'strong',
		'text',
		'text', // Again.
		'emphasis',
		'text',
		'text',
		'strong',
		'text',
		'text',
		'inlineCode',
		'text',
	];

	visitParents({
		tree,
		enter: function (node) {
			assert.strictEqual(node.type, expected[n++], 'should be the expected type');

			if (again === false && node.type === 'strong') {
				again = true;
				return 0; // Start over.
			}
		},
	});

	assert.equal(n, expected.length, 'should visit nodes again');
});

test('should support a given `index` to iterate over next (`children.length` to skip further children)', function () {
	let n = 0;
	let again = false;
	const expected = [
		'root',
		'paragraph',
		'text',
		'emphasis',
		'text',
		'text',
		'strong', // Skip here. */
		'text',
	];

	visitParents({
		tree,
		enter: function (node, parents) {
			const parent = parents[parents.length - 1];

			assert.strictEqual(node.type, expected[n++], 'should be the expected type');

			if (again === false && node.type === 'strong') {
				again = true;
				return parent.children.length; // Skip siblings.
			}
		},
	});

	assert.equal(n, expected.length, 'should skip nodes');
});

test('should support any other given `index` to iterate over next', function () {
	let n = 0;
	let again = false;
	const expected = [
		'root',
		'paragraph',
		'text',
		'emphasis',
		'text',
		'text',
		'strong',
		'text',
		'inlineCode', // Skip to here.
		'text',
	];

	visitParents({
		tree,
		enter: function (node, parents) {
			const parent = parents[parents.length - 1];
			// @ts-expect-error: `node` can always be inside parent.
			const index = parent ? parent.children.indexOf(node) : undefined;

			assert.strictEqual(node.type, expected[n++], 'should be the expected type');

			if (index !== undefined && again === false && node.type === 'strong') {
				again = true;
				return index + 2; // Skip to `inlineCode`.
			}
		},
	});

	assert.equal(n, expected.length, 'should skip nodes');
});

test('should support any other given `index` to iterate over next (tuple)', function () {
	let n = 0;
	let again = false;
	const expected = [
		'root',
		'paragraph',
		'text',
		'emphasis',
		'text',
		'text',
		'strong',
		'text',
		'inlineCode', // Skip to here.
		'text',
	];

	visitParents({
		tree,
		enter: function (node, parents) {
			const parent = parents[parents.length - 1];
			// @ts-expect-error: `node` can always be inside parent.
			const index = parent ? parent.children.indexOf(node) : undefined;

			assert.strictEqual(node.type, expected[n++], 'should be the expected type');

			if (index !== undefined && again === false && node.type === 'strong') {
				again = true;
				return [undefined, index + 2]; // Skip to `inlineCode`.
			}
		},
	});

	assert.equal(n, expected.length, 'should skip nodes');
});

test('should visit added nodes', function () {
	const tree = fromMarkdown('Some _emphasis_, **importance**, and `code`.');
	const other = fromMarkdown('Another [sentence]($sentence).');
	const l = types.length + 5; // (p, text, link, text, text)
	let n = 0;

	visitParents({
		tree,
		enter: function (_, parents) {
			n++;

			if (n === 2) {
				const parent = parents[parents.length - 1];
				assert.ok(parent.type === 'root');
				parent.children.push(...other.children);
			}
		},
	});

	assert.equal(n, l, 'should walk over all nodes');
});

test('should visit nodes in the correct order', function () {
	const tree = fromMarkdown('Some _emphasis_, **importance**, `code` and [link](#link "title").');
	const preorder: string[] = [];
	const postorder: string[] = [];

	visitParents({
		tree,
		enter: (node) => {
			preorder.push(node.type === 'text' ? `text (${node.value})` : node.type);
		},
		leave: (node) => {
			postorder.push(node.type === 'text' ? `text (${node.value})` : node.type);
		},
	});

	const expectedPreorder: string[] = [
		'root',
		'paragraph',
		'text (Some )',
		'emphasis',
		'text (emphasis)',
		'text (, )',
		'strong',
		'text (importance)',
		'text (, )',
		'inlineCode',
		'text ( and )',
		'link',
		'text (link)',
		'text (.)',
	];

	const expectedPostorder: string[] = [
		'text (Some )',
		'text (emphasis)',
		'emphasis',
		'text (, )',
		'text (importance)',
		'strong',
		'text (, )',
		'inlineCode',
		'text ( and )',
		'text (link)',
		'link',
		'text (.)',
		'paragraph',
		'root',
	];

	assert.deepEqual(
		preorder,
		expectedPreorder,
		'should not visit nodes in the wrong order (preorder)'
	);
	assert.deepEqual(
		postorder,
		expectedPostorder,
		'should visit nodes in the correct order (postorder)'
	);
});

test('should recurse into a bazillion nodes', function () {
	const expected = 3000;
	const tree = fromMarkdown(Array.from({ length: expected / 4 }).join('* 1. ') + 'asd');
	let n = 1;

	visitParents({
		tree,
		enter: function () {
			n++;
		},
	});

	assert.equal(n, expected, 'should walk over all nodes');
});

test('should add a pretty stack (hast)', function () {
	const tree: import('hast').Root = {
		type: 'root',
		children: [
			{
				type: 'element',
				tagName: 'div',
				properties: {},
				children: [{ type: 'text', value: 'Oh no!' }],
			},
		],
	};
	let message = '';

	try {
		visitParents({
			tree,
			test: 'text',
			enter: function (node) {
				throw new Error(node.value);
			},
		});
	} catch (error) {
		message = String(error && typeof error === 'object' && 'stack' in error ? error.stack : error);
	}

	const stack = message
		.replace(/\(\S*\/([\w.]+\.[tj]s):\d+:\d+\)/gm, '($1:1:1)')
		.split('\n')
		.slice(0, 6)
		.join('\n');

	assert.equal(
		stack,
		[
			'Error: Oh no!',
			'    at enter (visit.test.ts:1:1)',
			'    at node (text) (visit.ts:1:1)',
			'    at node (element<div>) (visit.ts:1:1)',
			'    at node (root) (visit.ts:1:1)',
			'    at visitParents (visit.ts:1:1)',
		].join('\n'),
		'should provide a useful stack trace'
	);
});

test('should add a pretty stack (xast)', function () {
	const tree: import('xast').Root = {
		type: 'root',
		children: [
			{
				type: 'element',
				name: 'xml',
				attributes: {},
				children: [{ type: 'text', value: 'Oh no!' }],
			},
		],
	};
	let message = '';

	try {
		visitParents({
			tree,
			test: 'text',
			enter: function (node) {
				throw new Error(node.value);
			},
		});
	} catch (error) {
		message = String(error && typeof error === 'object' && 'stack' in error ? error.stack : error);
	}

	const stack = message
		.replace(/\(\S*\/([\w.]+\.[tj]s):\d+:\d+\)/gm, '($1:1:1)')
		.split('\n')
		.slice(0, 6)
		.join('\n');

	assert.equal(
		stack,
		[
			'Error: Oh no!',
			'    at enter (visit.test.ts:1:1)',
			'    at node (text) (visit.ts:1:1)',
			'    at node (element<xml>) (visit.ts:1:1)',
			'    at node (root) (visit.ts:1:1)',
			'    at visitParents (visit.ts:1:1)',
		].join('\n')
	);
});
