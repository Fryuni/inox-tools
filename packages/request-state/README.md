<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Request State

Shared request state between server and client

## Install

```js
npm i @inox-tools/request-state
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import requestState from '@inox-tools/request-state';

export default defineConfig({
  integrations: [requestState({})],
});
```
