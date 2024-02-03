---
title: Generated modules
description: 'What does the generated modules look like?'
---

We strive to make the generated module as simple as possible while maininting all the behavior from the original code.

Sometimes it is impossible to identify whether some edge cases will happen or not, so the generated code might be more complicated than the original code.

## Simple values

Simple values that can fully inspected are serialized with their normal JS syntax. Those include:
- Strings
- Numbers
- Plain objects without nesting
- Arrays without nesting
- Booleans
- `BigInt`s
- Symbols

For example the following module declaration:

```ts
inlineModule({
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
})
```

Generates the following module:

```js
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
```

## Nested arrays and objects

WIP
