---
title: Modular Station - Consumer
packageName: '@inox-tools/modular-station'
description: Simplifying Astro integrations with a flexible docking system.
---

Integrations using Modular Station can provide custom APIs and/or hooks for your integration to use without restricting the flexibility of neither integrations.

## APIs

To use the APIs provided by an integration on your own, you have multiple options.

### Without Astro Integration Kit (the boring way)

If you don't use [Astro Integration Kit](https://astro-integration-kit.netlify.app/), first off you should, but if you really don't want to have an easy life, read ahead.

On your `astro:config:setup` or `astro:config:done` hooks you can get the API from the provided `AstroConfig` like so:

```ts title="my-integration.ts" ins={8-10}
import otherIntegration from 'other-integration';

export default () => {
  return {
    name: 'my-integration',
    hooks: {
      'astro:config:setup': ({ config }) => {
        const api = otherIntegration.fromConfig(config);

        api?.addSomething();
      },
    },
  };
};
```

The API might be `null` if the integration is not present. If needed, you can instantiate and add the integration yourself or use the optional API.

### With Astro Integration Kit (the fun way)

Integration providing APIs using Modular Station can be used as [AIK Plugins](https://astro-integration-kit.netlify.app/core/with-plugins/). You can use as either an optional plugin or a required plugin.

#### Optional plugin

You can call `asOptionalPlugin` on integrations using Modular Station to get an AIK Plugin that exposes that integration's API under a name of your choosing. If the integration is not present, the value in your hooks will be null.

Contrary to the method without AIK, this allows the API to be used on any hook:

```ts title="my-integration.ts" ins={2,7} {9-14}
import { withPlugins } from 'astro-integration-kit';
import otherIntegration from 'other-integration';

export default () => {
  return withPlugins({
    name: 'my-integration',
    plugins: [otherIntegration.asOptionalPlugin('otherApi')]
    hooks: {
      'astro:config:setup': ({ otherApi }) => {
        otherApi?.addSomething();
      },
      'astro:server:start': ({ otherApi }) => {
        otherApi?.addSomething();
      },
    },
  };
};
```

#### Required plugin

You can call `asPlugin` on integrations using Modular Station to get an AIK Plugin that exposes that integration's API under a name of your choosing. If the integration is not present, it will be added using the provided options. You must always provide the options even if it is already installed because that check happens later.

```ts title="my-integration.ts" ins={2,7} {9-14}
import { withPlugins } from 'astro-integration-kit';
import otherIntegration from 'other-integration';

export default () => {
  return withPlugins({
    name: 'my-integration',
    plugins: [otherIntegration.asPlugin('otherApi', {foo: 'bar'})]
    hooks: {
      'astro:config:setup': ({ otherApi }) => {
        otherApi.addSomething();
      },
      'astro:server:start': ({ otherApi }) => {
        otherApi.addSomething();
      },
    },
  };
};
```

## Hooks

Integrations that define custom hooks register allow your integration to observer and/or interfere with parts of it's own lifecycle.

### Type safety

When an integration provide it's own hooks using Modular Station, it has to provide the appropriate types for those hooks. To use them in your integration you have to load those types into typescript.

:::note[Astro Integration Kit]
Currently it is only possible to have proper type safety on your inter-integration hooks by using [Astro Integration Kit's `defineIntegration`](https://astro-integration-kit.netlify.app/core/define-integration/).

This limitation will soon be removed once [this change](https://github.com/withastro/astro/pull/11304) lands on Astro.
:::

#### Depending on the integration

If you use the integration as part of your integration, you probably already have the types loaded. Importing the library should automatically load the proper types.

If the types are not automatically loaded, check the documentation of the integration you are using to see

```ts {"Importing the integration loads the types":3-4} {12-14}
// your-integration/index.ts
import { defineIntegration } from 'astro-integration-kit';

import other from 'other-integration';

export default defineIntegration({
  name: 'your-integration',
  setup() {
    return {
      hooks: {
        // other hooks using the integration
        'other:integration:hooke': (hook, params) => {
          // hook params are property typed
        },
      },
    };
  },
});
```

#### Without depending on the integration

https://github.com/microsoft/TypeScript/issues/36812
