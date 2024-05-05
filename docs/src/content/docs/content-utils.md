---
title: Content Collections Utilities
packageName: '@inox-tools/content-utils'
description: Utilities to work with content collections on an Astro project from an integration or library.
---

## Collection Injection

Sometimes an integration would prefer to accept content or configurations in the form of content/data collections.
This can be useful when injecting dynamic pages that require specific field of an integration or when configuring a theme.

### `injectCollections`

AIK-style utility for integrations to declare their own content collections.
It accepts an `entrypoint` which should have the same exports as the `src/content/config.ts` would for a normal collection.

:::tip
The entrypoint should be resolvable from the root of the Astro project, so if the integration is provided as a package remember to export the file in your `package.json`.
:::

```ts title="integration.ts"
import { defineIntegration } from 'astro-integration-kit';
import { injectCollections } from '@inox-tools/content-utils';

export default defineIntegration({
  name: 'my-integration',
  setup: () => ({
    hooks: {
      'astro:config:setup': (params) => {
        injectCollections(params, {
          entrypoint: '@my/package/collections',
        });
      },
    },
  }),
});
```

### `@it-astro:content` virtual module

This virtual module provides the same API as `astro:content`, with the exception of `defineCollection`. Instead, `defineCollection` creates a `FancyCollection`, that can be extended by users of your integration.

For integration authors, it is a drop-in replacement.

```ts title="integration/collection.ts" del={1} ins={2}
import { defineCollection, z } from 'astro:content';
import { defineCollection, z } from '@it-astro:content';

export const collections = {
  darculaColors: defineCollection({
    type: 'data',
    schema: z.object({
      light: z.string(),
      dark: z.string(),
    }),
  }),
};
```

Users of your integrationo would then be able to extend the schema like so:

```ts title="src/content/config.ts"
import { defineCollection, z } from 'astro:content';
import { collections as integrationCollections } from '@my/integration/collections';

export const collections = {
  darculaColors: integrationCollections.darculaColors({
    extend: z.object({
      accent: z.string(),
    }),
  }),
};
```
