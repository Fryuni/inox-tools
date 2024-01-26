---
title: Custom Astro Routing
description: Define custom routes and entrypoints in an Astro project without relying on the file-based routing.
sidebar:
  label: Overview
  order: 0
---

This integration allows you to define custom routes for your Astro project independent of the file-system. Use whatever logic you want to define your routes.

```ts
// astro.config.mjs
import {customRouting} from '@inox-tools/custom-routing';

export default defineConfig({
  integrations: [
    customRouting({
      // Use Astro files outside of src/pages as the entrypoint
      '/blog/[...slug]': './src/routes/blog.astro', 

      // Reuse the same entrypoint for more than one route for more precise control
      // here defining that the route should be only on the tag index and with a single segment
      'tag': './src/routes/tags.astro',
      'tag/[tag]': './src/routes/tags.astro', 

      // Publish common Astro files shared across projects as dependencies and use them here
      'compliance': '@company/legal-pages/compliance.astro',
    }),
  ],
});
```

### License

Custom Routing is available under the MIT license.

