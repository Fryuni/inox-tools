---
title: defineMiddleware
description: Allows defining an Astro middleware inline.
---

`defineMiddleware` allows you to define an Astro middleware inline.

```ts /defineMiddleware\\b/ {2,7}
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

