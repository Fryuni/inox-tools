<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Runtime Logger

Expose Astro Integration Logger at runtime for consistent output

## Install

```js
npm i @inox-tools/runtime-logger
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import runtimeLogger from '@inox-tools/runtime-logger';

export default defineConfig({
  integrations: [runtimeLogger({})],
});
```
