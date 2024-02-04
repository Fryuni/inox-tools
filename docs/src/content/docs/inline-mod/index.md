---
title: Inline Virtual Modules
description: Pass inline JS values and functions as a virtual module to Vite projects.
sidebar:
  label: Overview
  order: 0
---

Ever wanted to pass configuration values from build-time to runtime? To provide a clean and friendly API to customize an integration, theme or plugin with custom functions for maximum versatility, but was prevented from doing that by the different execution times of the configuration and the code of your library.

That is what this library is for!

It allows serializing non-trivial values into an ECMAScript module that can be imported at runtime, server or client. Currently, this library only provides bindings for Vite, but the core can be used to generate modules as files or to create binding for any other bundler that supports virtual modules.

Developers are then able to pass and receive non-trivial values on configuration files that affect the behavior of their applications.
For example, imagine you have a plugin to fetch remote fucntions locally

Imagine if you could have a Vite plugin with this API:

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [
    yourPlugin({
      fetchFunction: (url, requestInit) => {
        console.log('Lib is calling fetch');
        return fetch(url, requestInit);
      },
    }),
  ],
});
```

And access your configuration at runtime inside your runtime code like a normal module:

```ts
// plugin/runtime.ts
import { fetchFunction } from 'yourLib:config';

const response = await fetchFunction(/* ... */);
```

No more weirdly JSON-based JS generators replicated in every project to serialize a configuration.  
No more oceans of flags and options to encode every possible use case as a plain object that can be turned into
a JSON to decide what to do at runtime. Use whatever is most semantic for your API. Supports:

- Classes
- Sub-classes
- Instances
- Functions
- Circular values
- Any type of `number` (including `Infinity`, `-Infinity`, `NaN` and `-0`)
- `BigInt`s
- Symbols
- Implementations of JS syntax features like custom iterators and async iterators
- And more!

## Getting Started

Add the Vite plugin that will resolve inline modules to their source code during the bundling:

```ts
// vite.config.mjs
import { defineConfig } from 'vite';
import inlineMod from '@inox-tools/inline-mod/vite';

export default defineConfig({
  plugins: [inlineMod()],
});
```

You can add the plugin embeded with your own plugin:

```ts
// your-plugin.ts
import inlineMod from '@inox-tools/inline-mod/vite';

export default () => {
  return [
    inlineMod(),
    {
      name: 'your-plugin',
      // ...
    },
  ];
};
```

Then define a module inline. For example to expose your configuration to runtime:

```ts ins={5-9,11-16}
// your-plugin.ts
import inlineMod, { defineModule } from '@inox-tools/inline-mod/vite';

type Options = {
  someFunction: () => string;
};

export default (options: Options) => {
  defineModule('virtual:your-plugin/config', {
    constExport: options,
  });

  return [
    inlineMod(),
    {
      name: 'your-plugin',
      // ...
    },
  ];
};
```

Now you can import your configuration anywhere in your code, be it in the server or the client.

```ts
import { someFunction } from 'virtual:your-plugin/config';

const configValue = someFunction();
```

## License

Because this is a port and derivation of part of an idea that is within some existing code,
the appropriate licensing for this is somewhat confusing. This section describes all that
I currenly know about it.

The original code by Pulumi Corporation is licensed under the Apache 2.0 license.  
All the code made by me is licensed under the MIT license.
