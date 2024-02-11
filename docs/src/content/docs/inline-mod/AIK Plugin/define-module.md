---
title: defineModule
description: Allows defining a named virtual module inline.
---

`defineModule` allows you to define a module inline with a given import name.

It receives the [definition of the virtual module](/inline-mod/vite-plugin/#inlinemodule).

```ts /defineModule\\b/ {2,7}
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

