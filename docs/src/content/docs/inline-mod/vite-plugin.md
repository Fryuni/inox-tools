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

#### `serializeFn` option

A function to allow excluding values referred in the module from being serialized. A functions excluded from serialization will throw if called at runtime.
