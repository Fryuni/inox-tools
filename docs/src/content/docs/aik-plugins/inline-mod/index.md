---
title: Inline Virtual Modules
packageName: '@inox-tools/aik-mod'
sidebar:
  label: Overview
  order: 2000
---

[Inox Tools' Inline Modules](/inline-mod/) are available as an [Astro Integration Kit](https://astro-integration-kit.netlify.app/) plugin for a simpler ergonomics on Astro integrations.

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
