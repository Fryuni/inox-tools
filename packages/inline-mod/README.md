<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Inline Virtual Modules

Ever wanted to pass configuration values from build-time to runtime? To provide a clean and friendly API to customize an integration, theme or plugin with custom functions for maximum versatility, but was prevented from doing that by the different execution times of the configuration and the code of your library.

That is what this library is for!

It allows serializing non-trivial values into an ECMAScript module that can be imported at runtime, server or client. Currently, this library only provides bindings for Vite, but the core can be used to generate modules as files or to create binding for any other bundler that supports virtual modules.

Developers are then able to pass and receive non-trivial values on configuration files that affect the behavior of their applications.
For example, imagine you have a plugin to fetch remote fucntions locally

Imagine if you could have a Vite plugin with this API:

```ts
// vite.config.ts
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
import inlineModulePlugin from '@inox-tools/inline-mod/vite';

export default defineConfig({
  plugins: [inlineModulePlugin()],
});
```

Then define a module inline:

```ts
// vite.config.mjs
import { defineConfig } from 'vite';
import inlineModulePlugin, { defineModule } from '@inox-tools/inline-mod/vite';

defineModule('virtual:config', {
  constExport: {
    configFunction: () => 'value from config',
  },
});

// Or get the module name auto-generated
const moduleName = inlineModule({
  constExport: {
    configFunction: () => 'value from config',
  },
});

export default defineConfig({
  plugins: [inlineModulePlugin()],
});
```

Finally, import the defined module from anywhere in your code:

```ts
import { configFunction } from 'virtual:config';

const configValue = configFunction();
```

## License

Because this is a port and derivation of part of an idea that is within some existing code,
the appropriate licensing for this is somewhat confusing. This section describes all that
I currenly know about it.

The original code by Pulumi Corporation is licensed under the Apache 2.0 license.  
All the code made by me is licensed under the MIT license.
