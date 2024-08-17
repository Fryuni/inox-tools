<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Request Nanostores

[Nanostores](https://github.com/nanostores/nanostores) is a great and super compact state management library that is compatible with multiple frameworks, even with multiple at the same time. Nanostores has been Astro's recommended option for sharing state [between components](https://docs.astro.build/en/recipes/sharing-state/) and [between client islands](https://docs.astro.build/en/recipes/sharing-state-islands/).

Using Nanostores directly with Astro has some caveats, as explained on Astro's ["Why Nano Stores?" FAQ](https://docs.astro.build/en/recipes/sharing-state-islands/#why-nano-stores). They are meant for the client-side. Using them on the server, be it on framework components or on the frontmatter of Astro components, may cause problems with data race between requests. Once the page is rendered, the stores on the client won't have the data from the stores on the server, which may cause flickering and flashing of content on the screen as the client renders a different content from the server.

This integration bridges this gap and enables the use of Nanostores in Astro across server and client isolated on each request.

## Installing the dependency

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

### Prerequisites

When using the Cloudflare adapter, you'll need to [enable AsyncLocalStorage manually](https://developers.cloudflare.com/workers/runtime-apis/nodejs/#enable-only-asynclocalstorage).

## How to use

Wrap your stores using the `shared` function, giving it a name.

**The store name must be unique across your entire project!**.

```ts del={4} ins={5}
import { atom } from 'nanostores';
import { shared } from '@it-astro:request-nanostores';

export const $cart = atom([]);
export const $cart = shared('cart', atom([]));
```

It doesn't have to be an atom! You can use any store that is based on an atom:

```ts
import { shared } from '@it-astro:request-nanostores';
import { atom, map, deepMap } from 'nanostores';

export const $atom = shared('atom', atom([]));
export const $map = shared('map', map({}));
export const $deepMap = shared('deepMap', deepMap({}));
```

:::tip[Is it an Atom?]
If you don't know if a Nano Store is based on an Atom or not to use with this library, just try it!

Nano Stores are very well typed, so TypeScript will know if they are compatible or not.
:::

## License

Request Nanostores is available under the MIT license.
