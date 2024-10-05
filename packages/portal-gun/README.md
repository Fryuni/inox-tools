<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Portal Gun

Transport HTML elements through your page during rendering using Portals.

## Install

```js
npm i @inox-tools/portal-gun
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import portalGun from '@inox-tools/portal-gun';

export default defineConfig({
  integrations: [portalGun({})],
});
```
