---
title: AIK Plugin
packageName: '@inox-tools/aik-mod'
sidebar:
  order: 11
---

## Getting Started

Add the desired plugins (or all plugins) to your `defineIntegration` call:

```ts ins={2,9-12} ins=/\S(defineMiddlewarePlugin)/ ins=/defineMiddleware(?= )/
// your-integration.ts
import { defineMiddlewarePlugin } from '@inox-tools/aik-mod';

export default defineIntegration({
  name: 'your-integration',
  plugins: [defineMiddlewarePlugin],
  setup: () => ({
    'astro:config:setup': ({ defineMiddleware }) => {
      defineMiddleware('pre', (context, next) => {
        // Your inline middleware
        return next();
      });
    },
  }),
});
```

## API

Each functionality is provided as a separate AIK plugin that you can use.

All of them accept normal values and [factory wrappers](/inline-mod/factory-wrappers/) as values to be included in the virtual modules.

### `inlineModule`

`inlineModule` allows you to define a module inline, returning the name of the defined module.

It receives the [definition of the virtual module](/inline-mod/vite-plugin/#inlinemodule).

```ts /inlineModule\b/ {2,7}
// my-integration.ts
import { defineIntegration } from 'astro-integration-kit';
import { inlineModulePlugin } from '@inox-tools/aik-mod';

export default defineIntegration({
  name: 'my-integration',
  plugins: [inlineModulePlugin],
  setup(options) {
    return {
      'astro:config:setup': ({ inlineModule }) => {
        const moduleName = inlineModule({
          defaultExport: 'some value',
          constExports: {},
          assignExports: {},
        });
      },
    };
  },
});
```

### `defineModule`

`defineModule` allows you to define a module inline with a given import name.

It receives the [definition of the virtual module](/inline-mod/vite-plugin/#inlinemodule).

```ts /defineModule\b/ {2,7}
// my-integration.ts
import { defineIntegration } from "astro-integration-kit";
import { defineModulePlugin } from "@inox-tools/aik-mod";

export default defineIntegration({
    name: "my-integration",
    plugins: [defineModulePlugin],
    setup(options) {
        return {
            "astro:config:setup": ({ defineModule }) => {
                defineModule('virtual:my-integration/module', {
                    defaultExport: 'some value',
                    constExports: {},
                    assignExports: {},
                }),
            },
        }
    }
});
```

### `defineMiddleware`

`defineMiddleware` allows you to define an Astro middleware inline.

```ts /defineMiddleware\b/ {2,7}
// my-integration.ts
import { defineIntegration } from "astro-integration-kit";
import { defineMiddlewarePlugin } from "@inox-tools/aik-mod";

export default defineIntegration({
    name: "my-integration",
    plugins: [defineMiddlewarePlugin],
    setup(options) {
        return {
            "astro:config:setup": ({ defineMiddleware }) => {
                defineMiddleware('pre', (context, next) => {
                    // This runs in the Astro middleware
                    return next();
                }),
            },
        }
    }
});
```
