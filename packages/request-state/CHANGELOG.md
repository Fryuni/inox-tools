# @inox-tools/request-state

## 0.8.0

### Minor Changes

- 771ef53: Updated dependencies

### Patch Changes

- Updated dependencies [771ef53]
  - @inox-tools/utils@0.9.0

## 0.7.2

### Patch Changes

- Updated dependencies [29e5288]
  - @inox-tools/utils@0.8.0

## 0.7.1

### Patch Changes

- 64c33ea: Fixed setting state to `undefined`. Previously, setting a state value to `undefined` would delete the key from the state map, making it indistinguishable from uninitialized state on the client side. This caused errors like "tried to use store before initialization" when using patterns like `$store.set(product?.specialOffer)` where the value might be `undefined`.

  Now explicit `undefined` values are properly serialized and deserialized using `devalue`, allowing `hasState()` to return `true` and `getState()` to return `undefined` for explicitly set undefined values.

## 0.7.0

### Minor Changes

- c0a5a51: Adds support for partial pages.

  Previously, state was added at the end of the body to be loaded once for the duration of the page view. During transitions using `<ClientRouter />`, the entire state was reloaded from the new document.
  Partial pages (pages in Astro using `export const partial = true`) do not generate a head or a full body. They work with client-side code to update just a portion of an already opened page with new HTML nodes. State generated on the server in requests to such partial pages was lost since there was no "end of body" in the response on which to attach the state.

  Now, state is added at the end of each request, even if there is no "end of body". The client-side code was updated to read new state (that hasn't yet been loaded into the page) from the document upon access. This allows a partial replacement of the DOM containing new state annotations that will be loaded once they are accessed.

  Conflicting state is not replaced; the first value sent to the client is retained until the user navigates to a different page. So state from a partial page request may _add_ entries to the page state, but not _remove_ nor _update_ them. In the future, we may add options to make this behavior configurable.

## 0.6.0

### Minor Changes

- 3048d13: Updated dependencies

### Patch Changes

- Updated dependencies [3048d13]
  - @inox-tools/utils@0.7.0

## 0.5.0

### Minor Changes

- cbae8d9: Updated dependencies

### Patch Changes

- Updated dependencies [cbae8d9]
  - @inox-tools/utils@0.6.0

## 0.4.2

### Patch Changes

- Updated dependencies [ed7e31e]
  - @inox-tools/utils@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [10fe460]
- Updated dependencies [1a1687b]
  - @inox-tools/utils@0.4.0

## 0.4.0

### Minor Changes

- 5392c77: Bump Astro version

## 0.3.2

### Patch Changes

- Updated dependencies [094efca]
  - @inox-tools/utils@0.3.1

## 0.3.1

### Patch Changes

- 0dcdeaa: Bump Astro Integration Kit

## 0.3.0

### Minor Changes

- 4870d82: Fixes flash of page with unsynchronized state due to response streaming.

## 0.2.0

### Minor Changes

- Minimal bump to sync inter-dependencies to Astro 5 and Vite 6

## 0.1.5

### Patch Changes

- Updated dependencies [21e0744]
- Updated dependencies [21e0744]
  - @inox-tools/utils@0.3.0

## 0.1.5-beta.0

### Patch Changes

- Updated dependencies [b4843b9]
- Updated dependencies [b4843b9]
  - @inox-tools/utils@0.3.0-beta.0

## 0.1.4

### Patch Changes

- Updated dependencies [e07b8a8]
  - @inox-tools/utils@0.2.0

## 0.1.3

### Patch Changes

- 8f04995: Add new Astro keywords

## 0.1.2

### Patch Changes

- Updated dependencies [b53264e]
  - @inox-tools/utils@0.1.4

## 0.1.1

### Patch Changes

- aae5d97: Refactor client state injection to be fully compliant with Web APIs
- f84ff80: Fixes resolution of runtime modules when integration is a transitive dependency with a strict package manager.

## 0.1.0

### Minor Changes

- 47e3f3f: Implement shared request state between server and client

### Patch Changes

- 56ae2c7: Add client-side events for state loading lifecycle
