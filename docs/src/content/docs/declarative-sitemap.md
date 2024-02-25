---
title: Self Declared Sitemap
---

An extension of the [official `@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/) integration to allow each page to declare whether it should be included in the sitemap.

```ts title="astro.config.mjs" del={1} add={2}
import sitemap from '@astrojs/sitemap';
import sitemap from '@inox-tools/declarative-sitemap';

export default defineConfig({
  integration: [sitemap()],
});
```

Export a boolean named `sitemap` on your pages and endpoints to define whether they should be included in the sitemap:

```astro
---
export const sitemap = true;
---
```

## Configuration

This extension accepts all the [options from `@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/#configuration), except for the `filter` function that is replaced by the declarative functionality.

### `includeByDefault`

**Type:** `boolean`
**Default:** `false`

Whether pages should that do not explicitly declare `export const sitemap` should be included in the sitemap.
