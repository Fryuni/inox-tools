import { expect, test } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

type SimpleBasicScenario = {
	name: string;
	value: unknown;
	expected: string;
};

test.each<SimpleBasicScenario>([
	{
		name: 'string',
		value: 'foobar',
		expected: '"foobar"',
	},
	{
		name: 'boolean',
		value: true,
		expected: 'true',
	},
	{
		name: 'basic number',
		value: 123,
		expected: '123',
	},
	{
		name: 'negative zero',
		value: -0,
		expected: '-0',
	},
	{
		name: 'not a number',
		value: Number.NaN,
		expected: 'Number.NaN',
	},
	{
		name: 'positive infinity',
		value: Number.POSITIVE_INFINITY,
		expected: 'Number.POSITIVE_INFINITY',
	},
	{
		name: 'negative infinity',
		value: Number.NEGATIVE_INFINITY,
		expected: 'Number.NEGATIVE_INFINITY',
	},
	{
		name: 'well-known symbol',
		value: Symbol.asyncIterator,
		expected: 'Symbol.asyncIterator',
	},
])('inlining simple basic value $name', async ({ value, expected }) => {
	const module = await inspectInlineMod({
		defaultExport: value,
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    export default ${expected};
  `);
});

type SimpleReferenceScenario = {
	name: string;
	value: unknown;
	env?: string;
	construction: string;
};

test.each<SimpleReferenceScenario>([
	{
		name: 'global symbol',
		value: Symbol.for('global thing'),
		construction: 'Symbol.for("global thing")',
	},
	{
		name: 'unique symbol',
		value: Symbol('unique thing'),
		construction: 'Symbol("unique thing")',
	},
	{
		name: 'simple array',
		value: [123, 'foo', 'bar'],
		construction: '[123, "foo", "bar"]',
	},
	{
		name: 'dual reference unique symbol',
		value: (() => {
			const s = Symbol('something unique');

			return [s, s];
		})(),
		env: 'const __defaultExport_0 = Symbol("something unique");',
		construction: '[__defaultExport_0, __defaultExport_0]',
	},
	{
		name: 'dual reference global symbol',
		value: (() => {
			const s = Symbol.for('something global');

			return [s, s];
		})(),
		env: 'const __defaultExport_0 = Symbol.for("something global");',
		construction: '[__defaultExport_0, __defaultExport_0]',
	},
	{
		name: 'dual reference well-known symbol',
		value: (() => {
			const s = Symbol.matchAll;

			return [s, s];
		})(),
		construction: '[Symbol.matchAll, Symbol.matchAll]',
	},
])('simple referenced value $name', async ({ value, env, construction }) => {
	const module = await inspectInlineMod({
		defaultExport: value,
	});

	expect(module.text).toEqualIgnoringWhitespace(`
    ${env ?? ''}
    const __defaultExport = ${construction};

    export default __defaultExport;
  `);
});

test('all at once', async () => {
	const module = await inspectInlineMod({
		constExports: {
			aString: 'some text',
			normalNumber: 123,
			float: 123.456,
			NaN: Number.NaN,
			negativeZero: -0,
			infinity: Infinity,
			negativeInfinity: -Infinity,
			bool: true,
			uniqueSymbol: Symbol('foo'),
			globalSymbol: Symbol.for('foo'),
			wellKnownSymbol: Symbol.match,
			simpleObject: {
				string: 'some text',
				normalNumber: 123,
				float: 123.456,
				NaN: Number.NaN,
				negativeZero: -0,
				infinity: Infinity,
				negativeInfinity: -Infinity,
				bool: true,
			},
			simpleArray: [
				'some text',
				123,
				123.456,
				Number.NaN,
				-0,
				Infinity,
				-Infinity,
				true,
			]
		},
	});

	expect(module.text).toEqualIgnoringWhitespace(`
		const __uniqueSymbol = Symbol("foo");
		const __globalSymbol = Symbol.for("foo");

		const __simpleObject = {
			string: "some text",
			normalNumber: 123,
			float: 123.456,
			NaN: Number.NaN,
			negativeZero: -0,
			infinity: Number.POSITIVE_INFINITY,
			negativeInfinity: Number.NEGATIVE_INFINITY,
			bool: true
		};

		const __simpleArray = ["some text", 123, 123.456, Number.NaN, -0, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, true];

		export const aString = "some text";
		export const normalNumber = 123;
		export const float = 123.456;
		export const NaN = Number.NaN;
		export const negativeZero = -0;
		export const infinity = Number.POSITIVE_INFINITY;
		export const negativeInfinity = Number.NEGATIVE_INFINITY;
		export const bool = true;
		export const uniqueSymbol = __uniqueSymbol;
		export const globalSymbol = __globalSymbol;
		export const wellKnownSymbol = Symbol.match;
		export const simpleObject = __simpleObject;
		export const simpleArray = __simpleArray;
	`);
})
