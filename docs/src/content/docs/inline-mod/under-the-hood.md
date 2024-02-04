---
title: Generated modules
description: 'What does the generated modules look like?'
sidebar:
  order: 10
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
    simpleArray: ['some text', 123, 123.456, Number.NaN, -0, Infinity, -Infinity, true],
  },
});
```

Generates the following module:

```js
const __uniqueSymbol = Symbol('foo');
const __globalSymbol = Symbol.for('foo');

const __simpleObject = {
  string: 'some text',
  normalNumber: 123,
  float: 123.456,
  NaN: Number.NaN,
  negativeZero: -0,
  infinity: Number.POSITIVE_INFINITY,
  negativeInfinity: Number.NEGATIVE_INFINITY,
  bool: true,
};

const __simpleArray = [
  'some text',
  123,
  123.456,
  Number.NaN,
  -0,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  true,
];

export const aString = 'some text';
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

```ts
inlineModule({
  constExports: {
    nestedArray: [123, [456], 789],
    nestedObject: {
      some: 'nested',
      value: {
        here: 123,
      },
    },
  },
});
```

Generates:

```js
const __nestedArray_1 = [456];

const __nestedArray = [];
__nestedArray[0] = 123;
__nestedArray[1] = __nestedArray_1;
__nestedArray[2] = 789;

const __nestedObject = {};

const __nestedObject_value = { here: 123 };
__nestedObject.some = 'nested';
__nestedObject.value = __nestedObject_value;

export const nestedArray = __nestedArray;
export const nestedObject = __nestedObject;
```

A bit more verbose than the original, but with the same result.

## Circular values

```ts
const circularArray = [];
circularArray.push(circularArray);
const circularObject = {};
circularObject.self = circularObject;

inlineModule({
  constExports: {
    circularArray,
    circularObject,
  },
});
```

Generates:

```ts
const __circularArray = [];
__circularArray[0] = __circularArray;

const __circularObject = {};
__circularObject.self = __circularObject;

export const circularArray = __circularArray;
export const circularObject = __circularObject;
```

## Sparse arrays

```ts
const array = [];
array[50] = 123;

inlineModule({
  constExports: {
    array,
  },
});
```

Generates:

```ts
const __array = [];
__array[50] = 123;

export const array = __array;
```

## Simple functions

```ts
inlineModule({
  constExports: {
    getValue: () => Math.random(),
  },
});
```

Generates:

```ts
const __f0 = () => Math.random();

export const getValue = __f0;
```

## Classes

Classes in ECMAScript are syntactic sugar for defining values on the prototype chain. At runtime, it is impossible to find the original syntax that generated the values.

For maximum compatibility and to maintain all the minute bahaviors that an implementation might need this library serializes the verbose detailed definition of the class, even if some of those might not be needed.

```ts
class FancyClass {
  public constructor(public state: string) {}

  public method() {
    console.log(this.state);
  }
}

inlineModule({
  constExports: {
    FancyClass,
  },
});
```

Generates:

```ts
function __f0(__0) {
  return function () {
    return function constructor(state) {
      this.state = state;
    };
  }
    .apply(undefined, undefined)
    .apply(this, arguments);
}

const __f0_prototype = {};
const __f1 = function method() {
  console.log(this.state);
};

Object.defineProperty(__f0_prototype, 'constructor', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: __f0,
});
Object.defineProperty(__f0_prototype, 'method', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: __f1,
});
Object.defineProperty(__f0, 'prototype', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: __f0_prototype,
});

export const FancyClass = __f0;
```

## Instances

Serializing an instance implicitly serialize the class that originated them as well as the instance state.

```ts
class FancyClass {
  public constructor(public state: string) {}

  public method() {
    console.log(this.state);
  }
}

inlineModule({
  constExports: {
    instance: new FancyClass('instance value'),
  },
});
```

Generates:

```ts
const __instance_proto = {};
const __f0 = function method() {
  console.log(this.state);
};

function __f1(__0) {
  return function () {
    return function constructor(state) {
      this.state = state;
    };
  }
    .apply(undefined, undefined)
    .apply(this, arguments);
}

Object.defineProperty(__f1, 'prototype', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: __instance_proto,
});
Object.defineProperty(__instance_proto, 'method', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: __f0,
});
Object.defineProperty(__instance_proto, 'constructor', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: __f1,
});

const __instance = Object.create(__instance_proto);
__instance.state = 'instance value';

export const instance = __instance;
```

## Capturing functions

```ts
const capturedValue = { counter: 0 };

inlineModule({
  constExports: {
    increment: () => capturedValue.counter++,
    read: () => capturedValue.counter,
  },
});
```

Generates:

```js
const __capturedValue = { counter: 0 };

function __f0() {
  return function () {
    const capturedValue = __capturedValue;
    return () => capturedValue.counter++;
  }
    .apply(undefined, undefined)
    .apply(this, arguments);
}

function __f1() {
  return function () {
    const capturedValue = __capturedValue;
    return () => capturedValue.counter;
  }
    .apply(undefined, undefined)
    .apply(this, arguments);
}

export const increment = __f0;

export const read = __f1;
```

## Imports of built-in modules

Values that were imported from a native Node module are detected and instead of serialized they are re-imported at runtime.

```ts
import * as path from 'node:path';
import fs from 'node:fs';
import { inspect } from 'node:util';

inlineModule({
  constExports: {
    path,
    fs,
    inspect,
  },
});
```

Generates:

```js
import * as __path from 'path';
import __fs from 'fs';
import { inspect as __inspect } from 'util';

export const path = __path;
export const fs = __fs;
export const inspect = __inspect;
```

## Import of third-party dependencies

Values imported from third-party libraries are also detected and not serialized. But this only works for values that are exported somewhere in the third-party library.

```ts
import * as one from 'lib-one';
import two from 'lib-two';
import { three } from 'lib-three';

inlineModule({
  constExports: {
    one,
    two,
    three,
  },
});
```

Generates:

```js
import * as __one from 'lib-one';
import __two from 'lib-two';
import { three as __three } from 'lib-three';

export const one = __one;
export const two = __two;
export const three = __three;
```

## Non-standard properties

```ts
const value = {};

Object.defineProperty(value, 'property', {
  value: 'value',
  writable: false,
  enumerable: false,
  configurable: false,
});

inlineModule({
  constExports: {
    obj: value,
  },
});
```

Generates:

```js
const __obj = {};

Object.defineProperty(__obj, 'property', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: 'value',
});

export const obj = __obj;
```
