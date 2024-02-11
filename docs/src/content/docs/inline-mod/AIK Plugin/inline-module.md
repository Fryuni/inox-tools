---
title: inlineModule
description: Allows defining a virtual module inline.
---

`inlineModule` allows you to define a module inline, returning the name of the defined module.

It receives the [definition of the virtual module](/inline-mod/vite-plugin/#inlinemodule).

```ts /inlineModule\\b/ {2,7}
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
