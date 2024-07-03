---
title: Modular Station - Hooks
packageName: '@inox-tools/modular-station'
description: Utilities for providing hooks between integrations
sidebar:
  label: Hooks
  badge:
    text: NEW
    variant: success
---

As an integration author, you might want to expose hooks of your own for other integrations to implement. Those can be used to pass information from one integration to other or to provide them the opportunity to change some of its behavior.

To avoid confusion, throughout this page you'll see these terms to refer to the integrations involved:

- **Source** integration: the integration that defines the name and type of the hook and provide the arguments to call it.
- **Target** integration: the integration that implements the hook that is called with the arguments provided by the source integration.

## Official support for custom hooks

Custom hooks between integrations are not officially supported yet. This is a work in progress an you can follow along on [this implementation PR](https://github.com/withastro/astro/pull/11304) and [this docs PR](https://github.com/withastro/docs/pull/8701). Hopefully this change will land on 4.12 or 4.13.

Until then, using custom hooks requires the target integrations to use [Astro Integration Kit's `defineIntegration`](https://astro-integration-kit.netlify.app/core/define-integration/) for proper type-safety.

## Type safety

When an integration provide it's own hooks using Modular Station, it has to provide the appropriate types for those hooks. To use them in your integration you have to load those types into typescript.

Where to import the types from will depend on the source integration, but we recommend it to be alongside the integration itself. If loading the ingration doesn't load the hook types, consult the documentation for the source integration.

### With runtime dependency

If the target uses the source integration at runtime, be it for installing it in case it is not already installed or to retrieve it's [API](/modular-station/api), the types will probably already be loaded. If the types are not automatically loaded, check the documentation of the source integration.

If you use the integration as part of your integration, you probably already have the types loaded. Importing the library should automatically load the proper types.

```ts title="target-integration/index.ts" {"Importing the integration loads the types":3-4} {12-14}
import { defineIntegration } from 'astro-integration-kit';

import source from 'source-integration';

export default defineIntegration({
  name: 'target-integration',
  setup() {
    return {
      hooks: {
        // other hooks using the integration
        'source:integration:hooke': (hook, params) => {
          // hook params are property typed
        },
      },
    };
  },
});
```

### Without runtime dependency

If the target doesn't use the source integration at runtime, you can load the types without importing the source integration. This allows you to have the source integration solely as a development dependency and not load any of it's code if the source integration is not used in the project.

The syntax for loading just the type augmentations from a library is quite non-intuitive, this is discussed on [this TypeScript issue](https://github.com/microsoft/TypeScript/issues/36812) from 2020. Even tho we can do `import 'module';` to load just it's runtime side-effects, we can't do `import type 'mod';` to load just it's type-level side-effects.

Instead, you can use one of the following syntaxes:

```ts title="target-integration/index.ts" {"OR": 2}
import type {} from 'source-integration';

/// <reference types="source-integration" />
```
