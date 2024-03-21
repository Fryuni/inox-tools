---
title: AIK Route Config
description: An AIK Plugin to add friendly per-route configuration to your integration
packageName: '@inox-tools/aik-route-config'
sidebar:
  label: Route Config
  order: 1
---

[Astro Integration Kit](https://astro-integration-kit.netlify.app/) is an **awesome** community project that aims to provide higher-level tools for integration developers while abstracting the low-level details of interacting with Astro and Vite internals.

## Installation

To install this plugin, install `@inox-tools/aik-route-config` and use it in your AIK integration:

```ts title="integration.ts" add={2,6}
import { defineIntegration } from 'astro-integration-kit';
import routeConfigPlugin from '@inox-tools/aik-route-config';

export default defineIntegration({
  name: 'my-integration',
  plugins: [routeConfigPlugin],
  setup() {
    return {
      'astro:config:setup': ({ defineRouteConfig }) => {
        defineRouteConfig({
          importName: 'sitemap-ext:config',
          callbackHandler: (context, configCb: ConfigCallback | boolean) => {},
        });
      },
    };
  },
});
```
