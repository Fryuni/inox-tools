---
title: Vite Plugin
description: API reference for the Inline Module Vite plugin
sidebar:
  order: 1
---

`@inox-tools/inline-mod/vite` exports the Vite plugin and the module declaration functions associated with the plugin.

To have virtual modules automatically resolved by Vite, just add the plugin to your Vite config like so:

```ts
import { defineConfig } from 'vite';
import inlineMod from '@inox-tools/inline-mod/vite';

export default defineConfig({
  plugins: [inlineMod()],
});
```

The Vite plugin is exported as `@inox-tools/inline-mod/vite`. It has no options. Adding it to your Vite config will automatically make Vite resolve any inline modules you define.

## Use in other plugins

You can use this plugin embeded with your own plugin:

```ts
import inlineMod from '@inox-tools/inline-mod/vite';

export default () => {
  return [
    inlineMod(),
    {
      name: 'your-plugin',
    },
  ];
};
```

## API

Along with the plugin, there are different functions to define virtual modules.

### `inlineModule`

Use this function to define a module inline. It receives the definition of a module and returns the name of the defined virtual module.

```ts
const inlineMod: ({
	constExports?: Record<string, unknown>;
	defaultExport?: unknown;
	assignExport?: unknown;
	serializeFn?: (val: unknown) => boolean;
}) => string;
```

#### `constExports` option

**type:** `Record<string, unknown>`

Define values that should be exported as named constants.

For example:

```ts
inlineMod({
  constExports: {
    foo: 'bar',
    baz: () => 'qux',
  },
});
```

Will generate a module that can be imported like so:

```ts
import { foo, baz } from 'virtual-import-string';

// OR

import * as allValues from 'virtual-import-string';
```

#### `defaultExport` option

**type:** `unknown`

Define a value that should be exported as a default export.

For example:

```ts
inlineMod({
  defaultExport: {
    foo: 'bar',
    baz: () => 'qux',
  },
});
```

Will generate a module that can be imported like so:

```ts
import defaultValue from 'virtual-import-string';

defaultValue.foo;
defaultValue.baz();
```

<!--
#### `assignExport` option

Defines a value that will be assigned as the export value. This is an advanced pattern to be used when you must export a value with a name that cannot be used as an ECMAScript identifier. This may be needed when your module is generated from external schemas.

In this case, the module can be imported using a wildcard import (`import * as name`) but not by name individually.

For example, if a value should have the name `function`:

```ts
inlineMod({
  assignExport: {
    function: () => 'value',
  },
});
```

This will generate a module like so:

```ts
import * as allValues from 'virtual-import-string';

// But this doesn't work
import { function } from 'virtual-import-string';
```

-->

#### `serializeFn` option

A function to allow excluding values referred in the module from being serialized. A functions excluded from serialization will throw if called at runtime.

### `defineModule`

This function accepts a name of a module and the same definition as [`inlineModule`](#inlinemodule). The generated module will be available at the given name instead of generating a new name.

```ts
defineModule('virtual:your-plugin/config', {
  constExports: {
    getValue: () => 'value',
  },
});
```

Can be imported as:

```js
import { getValue } from 'virtual:your-plugin/config';
```

### `factory`

Define a factory for a value that should be constructed at runtime. Use this when serializing the entire value is unnecessary since the value re-constructed more easily at runtime or when serializing the constructed value is not possible (if it contain references to native values).

For example, an API client may hold references to open sockets, attempting to serialize such a value will result in an error:

```ts
import { Storage } from '@google-cloud/storage';

const client = new Storage(); // Google Cloud Storage uses GRPC streams, holding an open socket.

// This serialization will fail.
inlineModule({
  defaultExport: client,
});
```

To solve this problem, wrap the construction of the value with a factory like so:

```ts
import { Storage } from '@google-cloud/storage';

const client = factory(() => new Storage());

inlineModule({
  defaultExport: client,
});
```

Now, instead of attempting to serialize the client, the factory will be serialized the result of calling it will be exported:

```js
import { Storage } from '@google-cloud/storage';

const __f0 = () => new Storage();

const __defaultValue = __f0();

export default __defaultValue;
```

The value constructed by the factory is also available at build time like before, but it is only constructed once you try to use it:

```ts
import { Storage } from '@google-cloud/storage';

const client = factory(() => new Storage());

inlineModule({
  defaultExport: client,
});

// Here the client is instantiated.
client.bucket();
```

This means that if the value is not used during build it will only be constructed at runtime.

### `asyncFactory`

Simmilar to [`factory`](#factory), this functions allows declaring how to construct a value at runtime. The key difference is that using `asyncFactory` the return value of the given factory function will be awaited.

This is useful when you want to load remote information upon initialization of your module, like loading credentials from a remote secret manager.

```ts
const configFactory = asyncfactory(async () => {
  const res = await fetch('https://config.store/myConfig');
  return res.json();
});

inlineModule({
  defaultExport: configFactory,
});
```

Will generate the following module:

```js
const __f0 = async () => {
  const res = await fetch('https://config.store/myConfig');
  return res.json();
};

const __defaultValue = await __f0();

export default __defaultValue;
```

Just like `factory`, the value can be used at runtime, but you need to pass the unawaited value to the module definition:

```ts
const configFactory = asyncfactory(async () => {
  const res = await fetch('https://config.store/myConfig');
  return res.json();
});

// You can await the factory to get the value during config time
const config = await configFactory;

inlineModule({
  // But you need to passs the factory, not the awaited value, to the module definition
  defaultExport: configFactory,
});
```
