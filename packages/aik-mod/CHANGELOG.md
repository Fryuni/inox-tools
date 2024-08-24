# @inox-tools/aik-mod

## 0.8.2

### Patch Changes

- 36180db: Add debug logging

## 0.8.1

### Patch Changes

- 255d6ba: Relax peer dependency restriction on Astro

## 0.8.0

### Minor Changes

- 0f6cde2: Bump Astro version to 4.12

### Patch Changes

- Updated dependencies [0f6cde2]
  - @inox-tools/inline-mod@1.5.0

## 0.7.2

### Patch Changes

- f4c2ddb: Migrate to pnpm catalogs for consistency across packages
- Updated dependencies [f4c2ddb]
  - @inox-tools/inline-mod@1.4.4

## 0.7.1

### Patch Changes

- @inox-tools/inline-mod@1.4.3

## 0.7.0

### Minor Changes

- ebc7aa3: Bump Astro Integration Kit version

## 0.6.2

### Patch Changes

- @inox-tools/inline-mod@1.4.2

## 0.6.1

### Patch Changes

- @inox-tools/inline-mod@1.4.1

## 0.6.0

### Minor Changes

- b6d23ab: Updates the minimum supported version of Astro Integration Kit to `0.13.0`

## 0.5.2

### Patch Changes

- 8a4ed54: Bump all dependencies
- 8a4ed54: Expand support for AIK 0.11
- 7cc941f: Implements new `lazyValue` utility
- Updated dependencies [8a4ed54]
- Updated dependencies [7cc941f]
  - @inox-tools/inline-mod@1.4.0

## 0.5.1

### Patch Changes

- 0523723: Fixes a type issue with `DeepPartial`

  The `DeepPartial` type utility from `astro` was being inlined in the `aik-mod` package without being exported, preventing integrations using `aik-mod` from having a named type.

## 0.5.0

### Minor Changes

- 49a8d88: Bump minimal AIK version to 0.10

## 0.4.0

### Minor Changes

- a81f657: Update to AIK 0.8

## 0.3.1

### Patch Changes

- Updated dependencies [e70cea1]
  - @inox-tools/inline-mod@1.3.1

## 0.3.0

### Minor Changes

- b5a53ab: Bump AIK to version 0.7

## 0.2.2

### Patch Changes

- 9b8b5a0: Expand supported versions of AIK up to 0.6
- Updated dependencies [9b8b5a0]
  - @inox-tools/inline-mod@1.3.0

## 0.2.1

### Patch Changes

- 8e8defe: Update dependencies
- Updated dependencies [8e8defe]
  - @inox-tools/inline-mod@1.2.1

## 0.2.0

### Minor Changes

- 0b0b8a0: Bump AIK version, now compatible with 0.2.x and 0.3.x

## 0.1.0

### Minor Changes

- a4046d5: Reject definition of reserved module
- a4046d5: Implement `defineMiddleware` plugin

### Patch Changes

- Updated dependencies [a4046d5]
- Updated dependencies [e830a7e]
  - @inox-tools/inline-mod@1.2.0

## 0.1.0-beta.2

### Minor Changes

- ce1ea71: Reject definition of reserved module

### Patch Changes

- Updated dependencies [8cee245]
- Updated dependencies [e830a7e]
  - @inox-tools/inline-mod@1.2.0-beta.0

## 0.0.1-beta.1

### Patch Changes

- Do not inline the inliner

## 0.0.1-beta.0

### Patch Changes

- a0bcd68: Initial test version
- 727f960: Implement `defineMiddleware` plugin
