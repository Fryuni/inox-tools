<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Star Warp

Starlight warp-drive search

## Install

```js
npm i @inox-tools/star-warp
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import starWarp from '@inox-tools/star-warp';

export default defineConfig({
  integrations: [starWarp({})],
});
```
