---
title: Astro When
packageName: '@inox-tools/astro-when'
description: Define custom routes and entrypoints in an Astro project without relying on the file-based routing.
---

This integration provides an import that exposes when in the lifecycle of an Astro codebase your code is running.

When/Where your code is running is made available as an exported constant, so you can change even the exported values of your modules based on it.

## Installing the integration

This integration is needed during build time only, so you can install it as a dev dependency.

```bash title="Installing dependency"
npm install -D @inox-tools/astro-when
# OR
yarn add -D @inox-tools/astro-when
# OR
pnpm add -D @inox-tools/astro-when
```

Then add it to your Astro config:

```ts ins={2,5}
// astro.config.mjs
import astroWhen from '@inox-tools/astro-when';

export default defineConfig({
  integrations: [astroWhen()],
});
```

## How to use

Anywhere in your code, be it on a TypeScript file, an Astro component, an MDX file or any UI framework file, you can an import from `@it-astro:when`. This module exports the following:

- An enum `When` defining the constant for each scenario your code might be running.
- A constant `whenAmI`, which is a value of type `When`.

The possible values are:

- `When.Client`: When your code is running on the client side.
- `When.Server`: When your code is running on a prod server serving an SSR route.
- `When.Prerender`: When your code is running during build to prerendeer a route on a project outputing for an SSR runtime.
- `When.StaticBuild`: When your code is running during build to prerender a route on a project that is entirely static (no SSR adapter and `output: 'static'`).
- `When.DevServer`: When your code is running on the server during development.

:::note
`astro preview` is intended to behave as a prod server, so instead of exposing that as `When.PreviewServer` it is intentionally exposed as `When.Server`.
:::

## Example

You can check [this example](https://github.com/Fryuni/inox-tools/tree/main/examples/astro-when) on when each value shows up. You can also see it in action on a deployment of that same example [here](https://inox-tools-ex-astro-when.pages.dev/).

## License

Astro When is available under the MIT license.
