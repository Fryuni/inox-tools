<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Request Nanostores

Make your Nanostores concurrent safe and shared from server to client

## Install

```js
npm i @inox-tools/request-nanostores
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import requestNanostores from '@inox-tools/request-nanostores';

export default defineConfig({
  integrations: [requestNanostores({})],
});
```
