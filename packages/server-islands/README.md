<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Server Islands

Common tools and utilities for working with Server Islands.

## Install

```js
npm i @inox-tools/server-islands
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import serverIslands from '@inox-tools/server-islands';

export default defineConfig({
  integrations: [serverIslands({})],
});
```
