# @inox-tools/request-nanostores

## 0.6.1

### Patch Changes

- Updated dependencies [29e5288]
  - @inox-tools/utils@0.8.0
  - @inox-tools/request-state@0.7.2

## 0.6.0

### Minor Changes

- c0a5a51: Adds support for partial pages.

  Previously, state was added at the end of the body to be loaded once for the duration of the page view. During transitions using `<ClientRouter />`, the entire state was reloaded from the new document.
  Partial pages (pages in Astro using `export const partial = true`) do not generate a head or a full body. They work with client-side code to update just a portion of an already opened page with new HTML nodes. State generated on the server in requests to such partial pages was lost since there was no "end of body" in the response on which to attach the state.

  Now, state is added at the end of each request, even if there is no "end of body". The client-side code was updated to read new state (that hasn't yet been loaded into the page) from the document upon access. This allows a partial replacement of the DOM containing new state annotations that will be loaded once they are accessed.

  Conflicting state is not replaced; the first value sent to the client is retained until the user navigates to a different page. So state from a partial page request may _add_ entries to the page state, but not _remove_ nor _update_ them. In the future, we may add options to make this behavior configurable.

### Patch Changes

- Updated dependencies [c0a5a51]
  - @inox-tools/request-state@0.7.0

## 0.5.0

### Minor Changes

- 3048d13: Updated dependencies

### Patch Changes

- Updated dependencies [3048d13]
  - @inox-tools/request-state@0.6.0
  - @inox-tools/utils@0.7.0

## 0.4.0

### Minor Changes

- cbae8d9: Updated dependencies

### Patch Changes

- Updated dependencies [cbae8d9]
  - @inox-tools/request-state@0.5.0
  - @inox-tools/utils@0.6.0

## 0.3.2

### Patch Changes

- Updated dependencies [ed7e31e]
  - @inox-tools/utils@0.5.0
  - @inox-tools/request-state@0.4.2

## 0.3.1

### Patch Changes

- Updated dependencies [10fe460]
- Updated dependencies [1a1687b]
  - @inox-tools/utils@0.4.0
  - @inox-tools/request-state@0.4.1

## 0.3.0

### Minor Changes

- 5392c77: Bump Astro version
- 5392c77: Bump Nanostores to v1

### Patch Changes

- Updated dependencies [5392c77]
  - @inox-tools/request-state@0.4.0

## 0.2.3

### Patch Changes

- Updated dependencies [094efca]
  - @inox-tools/utils@0.3.1
  - @inox-tools/request-state@0.3.2

## 0.2.2

### Patch Changes

- 0dcdeaa: Bump Astro Integration Kit
- Updated dependencies [0dcdeaa]
  - @inox-tools/request-state@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [4870d82]
  - @inox-tools/request-state@0.3.0

## 0.2.0

### Minor Changes

- Minimal bump to sync inter-dependencies to Astro 5 and Vite 6

### Patch Changes

- Updated dependencies
  - @inox-tools/request-state@0.2.0

## 0.1.5

### Patch Changes

- Updated dependencies [21e0744]
- Updated dependencies [21e0744]
  - @inox-tools/utils@0.3.0
  - @inox-tools/request-state@0.1.5

## 0.1.5-beta.0

### Patch Changes

- Updated dependencies [b4843b9]
- Updated dependencies [b4843b9]
  - @inox-tools/utils@0.3.0-beta.0
  - @inox-tools/request-state@0.1.5-beta.0

## 0.1.4

### Patch Changes

- Updated dependencies [e07b8a8]
  - @inox-tools/utils@0.2.0
  - @inox-tools/request-state@0.1.4

## 0.1.3

### Patch Changes

- 8f04995: Add new Astro keywords
- Updated dependencies [8f04995]
  - @inox-tools/request-state@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [b53264e]
  - @inox-tools/utils@0.1.4
  - @inox-tools/request-state@0.1.2

## 0.1.1

### Patch Changes

- f84ff80: Fixes resolution of runtime modules when integration is a transitive dependency with a strict package manager.
- Updated dependencies [aae5d97]
- Updated dependencies [f84ff80]
  - @inox-tools/request-state@0.1.1

## 0.1.0

### Minor Changes

- 0bcabfd: Implement shared Nanostores for Astro
