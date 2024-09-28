<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Cut Short

Immediately halt request processing and return custom responses effortlessly.

## Install

```js
npm i @inox-tools/cut-short
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro'
import cutShort from '@inox-tools/cut-short';

export default defineConfig({
    integrations: [cutShort({})]
})
```
