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

## As a source integration

### Type safety

:::note[Official support]
Custom hooks between integrations are not officially supported yet. You can follow the ongoing effort to support it on [this implementation PR](https://github.com/withastro/astro/pull/11304) and [this docs PR](https://github.com/withastro/docs/pull/8701).

Until then, custom hooks uses [Astro Integration Kit](https://astro-integration-kit.netlify.app/) to provide proper type-safety.
:::

Source integrations can declare the types for their hooks by augmenting the interface `ExtraHooks` on namespace `AstroIntegrationKit` on an ambient declaration file (`.d.ts`):

```ts title="types.d.ts"
declare namespace AstroIntegrationKit {
  export interface ExtraHooks {
    'source:integration:hook'?: (
      hook: string,
      params: Record<string, any>,
      logger: AstroIntegrationLogger
    ) => Promise<void> | void;
  }
}
```

That augmentation can also be done inline on any TypeScript file by surrounding it with `declare global`:

```ts title="source-integration/index.ts"
declare global {
  namespace AstroIntegrationKit {
    export interface ExtraHooks {
      // ...
    }
  }
}
```

### Hook provider plugin

Source integrations can trigger hooks using the Hook Provider Plugin, which does the heavy lifting of:

- Properly collecting the target ingrations in use on the Astro project, including integrations added dynamically;
- Instantiating the logger to be passed to each target integration such that it matches the logger passed in the official hooks;
- Calling the appropriate hook for each integration in the same order as Astro's official hooks.

The Hook Provider Plugin is a special kind of [Astro Integration Kit plugin](https://astro-integration-kit.netlify.app/core/with-plugins/) that provides the most effective implementation of the hook triggering mechanism for _all_ your hooks, even other custom hooks in case your source integration is a target of some other integration.

```ts title="source-integration/index.ts" ins={2,9,12-18}
import { defineIntegration, withPlugins } from 'astro-integration-kit';
import { hookProviderPlugin } from '@inox-tools/modular-station';

export default defineIntegration({
  name: 'source-integration',
  setup({ name }) {
    return withPlugins({
      name,
      plugins: [hookProviderPlugin],
      hooks: {
        'astro:server:setup': ({ hooks }) => {
          hooks.run(
            // Hook name
            'source:integration:hook',
            // Callback to make the arguments for each target integration
            // Receives the logger for the target integration
            (logger) => ['param', { from: 'source' }, logger]
          );
        },
      },
    });
  },
});
```

## As a target integration

### Type safety

:::note[Official support]
Custom hooks between integrations are not officially supported yet. You can follow the ongoing effort to support it on [this implementation PR](https://github.com/withastro/astro/pull/11304) and [this docs PR](https://github.com/withastro/docs/pull/8701).

Until then, using custom hooks requires the target integrations to use [Astro Integration Kit's `defineIntegration`](https://astro-integration-kit.netlify.app/core/define-integration/) for proper type-safety.
:::

When an integration provide it's own hooks using Modular Station, it has to provide the appropriate types for those hooks. To use them in your integration you have to load those types into typescript.

Where to import the types from will depend on the source integration, but we recommend it to be alongside the integration itself. If loading the ingration doesn't load the hook types, consult the documentation for the source integration.

#### With runtime dependency

If the target uses the source integration at runtime, be it for installing it in case it is not already installed or to retrieve it's [API](/modular-station/api), the types will probably already be loaded. If the types are not automatically loaded, check the documentation of the source integration.

If you use the integration as part of your integration, you probably already have the types loaded. Importing the library should automatically load the proper types.

```ts title="target-integration/index.ts" {"Importing the integration loads the types":2-3} {11-13}
import { defineIntegration } from 'astro-integration-kit';

import source from 'source-integration';

export default defineIntegration({
  name: 'target-integration',
  setup() {
    return {
      hooks: {
        // other hooks using the integration
        'source:integration:hook': (hook, params) => {
          // hook params are property typed
        },
      },
    };
  },
});
```

#### Without runtime dependency

If the target doesn't use the source integration at runtime, you can load the types without importing the source integration. This allows you to have the source integration solely as a development dependency and not load any of it's code if the source integration is not used in the project.

The syntax for loading just the type augmentations from a library is quite non-intuitive, this is discussed on [this TypeScript issue](https://github.com/microsoft/TypeScript/issues/36812) from 2020. Even tho we can do `import 'module';` to load just it's runtime side-effects, we can't do `import type 'mod';` to load just it's type-level side-effects.

Instead, you can use one of the following syntaxes:

```ts title="target-integration/index.ts" {"OR": 2}
import type {} from 'source-integration';

/// <reference types="source-integration" />
```
