# @inox-tools/astro-tests

## 0.5.1

### Patch Changes

- 21391cf: Add methods to read binary files using a test fixture.

  The existing `readFile` and `readSrcFile` methods retain their behavior, reading files as strings,
  but now also accept an optional `encoding` parameter to change how the file is decoded into a string.

  Two new methods, `readFileAsBuffer` and `readSrcFileAsBuffer` mirror the existing `readFile` and `readSrcFile` methods,
  but return a `Buffer` object containing the raw bytes read from the file.

## 0.5.0

### Minor Changes

- 2e64078: Use stable Astro APIs

## 0.4.0

### Minor Changes

- 86edf1c: Allow file edits and resets to create and delete files in the source code

## 0.3.0

### Minor Changes

- dea57f8: Publish package unbundled to work better with multiple versions of PlayWright

### Patch Changes

- Updated dependencies [094efca]
  - @inox-tools/utils@0.3.1

## 0.2.2

### Patch Changes

- 0dcdeaa: Bump Astro Integration Kit

## 0.2.1

### Patch Changes

- Minimal bump to sync inter-dependencies to Astro 5 and Vite 6

## 0.2.0

### Minor Changes

- 21e0744: Bump support to Astro 5

### Patch Changes

- 21e0744: Fix opt-out of Vite's dependency optimization during tests
- Updated dependencies [21e0744]
- Updated dependencies [21e0744]
  - @inox-tools/utils@0.3.0

## 0.2.0-beta.1

### Patch Changes

- ed6f403: Fix opt-out of Vite's dependency optimization during tests

## 0.2.0-beta.0

### Minor Changes

- b4843b9: Bump support to Astro 5

### Patch Changes

- Updated dependencies [b4843b9]
- Updated dependencies [b4843b9]
  - @inox-tools/utils@0.3.0-beta.0

## 0.1.6

### Patch Changes

- aa73961: Remove global change to `debug` package options

## 0.1.5

### Patch Changes

- d81825e: Add package description

## 0.1.4

### Patch Changes

- Updated dependencies [e07b8a8]
  - @inox-tools/utils@0.2.0

## 0.1.3

### Patch Changes

- 8f04995: Add new Astro keywords

## 0.1.2

### Patch Changes

- b53264e: Export `TestApp` type
- Updated dependencies [b53264e]
  - @inox-tools/utils@0.1.4

## 0.1.1

### Patch Changes

- 17a49c6: Pick default fixture port at random
- 81db094: Add debug logging

## 0.1.0

### Minor Changes

- e6102fc: Initial release
