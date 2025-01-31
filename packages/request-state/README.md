<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Request State

Astro provides [`Astro.locals`/`context.locals`](https://docs.astro.build/en/reference/api-reference/#astrolocals) for shared state between different components being rendered in a page.

This state can only be accessed from an Astro component using the `Astro` constant or from middlewares from the context. Sharing state between framework components is not provided and inconvenient. State using `Astro.locals` is also not shared with the client after the request completes, resulting in problems with the server and the client rendering different contents.

This library provides a solution for those problems:

- You can share state between any component used in a request, even between frameworks.
- The final state formed in the server while rendering a request is available for all client code running in the rendered page.
- UI framework components can keep their state from server to client.

## Installing the dependency

```sh
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

### Prerequisites

When using the Cloudflare adapter, you'll need to [enable AsyncLocalStorage manually](https://developers.cloudflare.com/workers/runtime-apis/nodejs/#enable-only-asynclocalstorage).

## How to use

Import the two functions anywhere in your code:

```ts
import { getState, setState } from '@it-astro:state';

setState('some key', 'some value');

const state = getState('some key');
```

Alternatively, provide an initial value to be used if not present in the state:

```ts
import { getState } from '@it-astro:state';

// `'initial value'` will be used if `'some key'` is not in the state
const state = getState('some key', 'initial value');
```

The state can be any value supported by the [`devalue` library](https://www.npmjs.com/package/devalue) plus:

- `Date`s
- `URL`s
- Global symbols (`Symbol.for`)
- Well-known symbols (`Symbol.XXX`)

### `setState`

Params:

- `key` (`string`): The key of a value in the state
- `value` (`unknown`): The value to be set

### `getState`

Params:

- `key` (`string`): The key of a value in the state
- `valueIfMissing` (`unknown`): An optional value to set if there is no value in the state for the given key.

Returns the value of the state for the given key, if present. If now, sets the value to `valueIfMissing` and returns it.

## License

Astro Request State is available under the MIT license.
