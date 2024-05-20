---
title: Modular Station
packageName: '@inox-tools/modular-station'
description: Simplifying Astro integrations with a flexible docking system.
---

:::tip
If an integration you are using pointed you here, you can skip to [How to use as a consumer](#how-to-use-as-a-consumer).
:::

This utility allows you, as an integration author, to expose APIs for other integrations that might be in use alogside yours. Instead of requiring them to call `addIntegration` instantiating yours, which has multiple limitations, they can use the API from your integration regardless of how it was installed.

## How to use as an author

Assuming you already have an integration, you can just wrap it in the `withApi` function to give it superpowers:

```ts title="my-integration.ts" ins={1,4,13} del={3,12}
import { withApi } from '@inox-tools/modular-station';

export default (options: Options) => {
export default withApi((options: Options) => {
  const sharedState = ...;

  return {
    hooks: {
      // ... using the shared state
    },
  };
};
});
```

With this, you can now expose APIs alongside your hooks:

```ts title="my-integration.ts" ins={10-12}
import { withApi } from '@inox-tools/modular-station';

export default withApi((options: Options) => {
  const sharedState = ...;

  return {
    hooks: {
      // ... using the shared state
    },
    addSomething(thing: string) {
      // add the thing to shared state
    },
  };
});
```

## How to use as a consumer

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

The API might be `null` if the integration is not present. In that case you can instantiate and add the integration yourself if you need the functionality. If it is optional, then just use the optional API.

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
