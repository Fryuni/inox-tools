# @inox-tools/portal-gun

## 1.4.0

### Minor Changes

- 771ef53: Updated dependencies

### Patch Changes

- Updated dependencies [771ef53]
  - @inox-tools/runtime-logger@0.8.0
  - @inox-tools/utils@0.9.0

## 1.3.1

### Patch Changes

- 6328ff4: Fixed portals placed inside inline elements (like `<p>` tags) when the portal content contains block elements (like `<div>`).

  Previously, using a custom element tag for portal entries caused HTML parsers to treat the portal as an inline element, leading to malformed HTML when block elements were sent through the portal. Now portal entries use a `<div>` placeholder with a data attribute, which correctly handles the block-in-inline parsing behavior.

  Note: When a block element inside a portal causes it to be moved out of an inline element, the inline element will be split, leaving empty tags (e.g., `<p></p><p></p>`). This is standard HTML parsing behavior and matches how MDX handles components that are alone on their lines. If this is undesired, consider using a plugin or a separate middleware to remove consecutive empty `<p>` tags.

  Fixes #257

- Updated dependencies [29e5288]
  - @inox-tools/utils@0.8.0
  - @inox-tools/runtime-logger@0.7.1

## 1.3.0

### Minor Changes

- 3048d13: Updated dependencies

### Patch Changes

- Updated dependencies [3048d13]
  - @inox-tools/runtime-logger@0.7.0
  - @inox-tools/utils@0.7.0

## 1.2.0

### Minor Changes

- cbae8d9: Updated dependencies

### Patch Changes

- Updated dependencies [cbae8d9]
  - @inox-tools/runtime-logger@0.6.0
  - @inox-tools/utils@0.6.0

## 1.1.2

### Patch Changes

- Updated dependencies [ed7e31e]
  - @inox-tools/utils@0.5.0
  - @inox-tools/runtime-logger@0.5.2

## 1.1.1

### Patch Changes

- Updated dependencies [10fe460]
- Updated dependencies [1a1687b]
  - @inox-tools/utils@0.4.0
  - @inox-tools/runtime-logger@0.5.1

## 1.1.0

### Minor Changes

- 5392c77: Bump Astro version

### Patch Changes

- Updated dependencies [5392c77]
  - @inox-tools/runtime-logger@0.5.0

## 1.0.3

### Patch Changes

- Updated dependencies [094efca]
  - @inox-tools/utils@0.3.1
  - @inox-tools/runtime-logger@0.4.2

## 1.0.2

### Patch Changes

- 0dcdeaa: Bump Astro Integration Kit
- Updated dependencies [0dcdeaa]
  - @inox-tools/runtime-logger@0.4.1

## 1.0.1

### Patch Changes

- Minimal bump to sync inter-dependencies to Astro 5 and Vite 6
- Updated dependencies
  - @inox-tools/runtime-logger@0.4.0

## 1.0.0

### Major Changes

- 21e0744: Bump support to Astro 5

### Patch Changes

- Updated dependencies [21e0744]
- Updated dependencies [21e0744]
  - @inox-tools/utils@0.3.0
  - @inox-tools/runtime-logger@0.3.6

## 1.0.0-beta.0

### Major Changes

- b4843b9: Bump support to Astro 5

### Patch Changes

- Updated dependencies [b4843b9]
- Updated dependencies [b4843b9]
  - @inox-tools/utils@0.3.0-beta.0
  - @inox-tools/runtime-logger@0.3.5-beta.0

## 0.1.1

### Patch Changes

- Updated dependencies [23b89bf]
  - @inox-tools/runtime-logger@0.3.5

## 0.1.0

### Minor Changes

- First release

## 0.0.1

### Patch Changes

- Updated dependencies [e07b8a8]
  - @inox-tools/utils@0.2.0
  - @inox-tools/runtime-logger@0.3.4
