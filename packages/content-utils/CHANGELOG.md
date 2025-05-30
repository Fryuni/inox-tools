# @inox-tools/content-utils

## 0.10.1

### Patch Changes

- Updated dependencies [10fe460]
- Updated dependencies [1a1687b]
  - @inox-tools/utils@0.4.0
  - @inox-tools/modular-station@0.5.1

## 0.10.0

### Minor Changes

- 5392c77: Bump Astro version

### Patch Changes

- Updated dependencies [5392c77]
  - @inox-tools/modular-station@0.5.0

## 0.9.2

### Patch Changes

- 1066b82: Fixes incorrect virtual module imports when Content Utils is only a transitive dependency of the root project.

## 0.9.1

### Patch Changes

- 828837c: Adds support for Git information associated with entries using Content Layer loaders instead of only legacy collections.
  Previously, git information was only available for collection entries made using the legacy behavior and only from the `src/content` directory.

  Now it is available for collection entries made from any loader that populates `filePath` referring to a file within the project tree (within the direction containing the Astro config file).

## 0.9.0

### Minor Changes

- 02f1df8: Add static only collection feature.

  Now users can pass `staticOnlyCollections` to the integration to make the entries of those integration not be shipped in the server bundle.

### Patch Changes

- 42eadc0: Add support for new content collections config file

## 0.8.2

### Patch Changes

- Updated dependencies [094efca]
  - @inox-tools/utils@0.3.1
  - @inox-tools/modular-station@0.4.2

## 0.8.1

### Patch Changes

- 0dcdeaa: Bump Astro Integration Kit
- Updated dependencies [0dcdeaa]
  - @inox-tools/modular-station@0.4.1

## 0.8.0

### Minor Changes

- Minimal bump to sync inter-dependencies to Astro 5 and Vite 6

### Patch Changes

- Updated dependencies
  - @inox-tools/modular-station@0.4.0

## 0.7.5

### Patch Changes

- Updated dependencies [21e0744]
- Updated dependencies [21e0744]
  - @inox-tools/utils@0.3.0
  - @inox-tools/modular-station@0.3.5

## 0.7.4-beta.0

### Patch Changes

- Updated dependencies [b4843b9]
- Updated dependencies [b4843b9]
  - @inox-tools/utils@0.3.0-beta.0
  - @inox-tools/modular-station@0.3.4-beta.0

## 0.7.4

### Patch Changes

- Updated dependencies [aa73961]
- Updated dependencies [aa73961]
  - @inox-tools/modular-station@0.3.4

## 0.7.3

### Patch Changes

- Updated dependencies [e07b8a8]
  - @inox-tools/utils@0.2.0
  - @inox-tools/modular-station@0.3.3

## 0.7.2

### Patch Changes

- 8f04995: Add new Astro keywords
- Updated dependencies [8f04995]
  - @inox-tools/modular-station@0.3.2

## 0.7.1

### Patch Changes

- Updated dependencies [b53264e]
  - @inox-tools/utils@0.1.4
  - @inox-tools/modular-station@0.3.1

## 0.7.0

### Minor Changes

- 666543e: Allow retrieving the Git authors and co-authors of Content Collection Entries

## 0.6.1

### Patch Changes

- 00895ec: Add debug logging
- d2d7220: Optimize git times to use a single git command instead of one per file

## 0.6.0

### Minor Changes

- 0f6cde2: Bump Astro version to 4.12

### Patch Changes

- Updated dependencies [0f6cde2]
  - @inox-tools/modular-station@0.3.0

## 0.5.3

### Patch Changes

- f4c2ddb: Migrate to pnpm catalogs for consistency across packages
- Updated dependencies [b4d7a16]
- Updated dependencies [f4c2ddb]
  - @inox-tools/utils@0.1.3
  - @inox-tools/modular-station@0.2.3

## 0.5.2

### Patch Changes

- Updated dependencies [0920491]
- Updated dependencies [f133739]
- Updated dependencies [f133739]
  - @inox-tools/modular-station@0.2.2
  - @inox-tools/utils@0.1.2

## 0.5.1

### Patch Changes

- fe6f703: Simplify internal hook wiring using Modular Station's global hooks
- Updated dependencies [fe6f703]
  - @inox-tools/modular-station@0.2.1

## 0.5.0

### Minor Changes

- ebc7aa3: Bump Astro Integration Kit version
- 70c0205: Add support for inter-integration hooks on collections Git lifecycle

### Patch Changes

- Updated dependencies [ebc7aa3]
- Updated dependencies [70c0205]
- Updated dependencies [eeab371]
  - @inox-tools/modular-station@0.2.0

## 0.4.0

### Minor Changes

- a62c2a7: Add module to retrieve Git times for collection entries

## 0.3.0

### Minor Changes

- 6a42c82: Refactor internals to use `@inox-tools/modular-station`

### Patch Changes

- 8830650: Replace package entrypoints for virtual modules with absolute filepaths
- Updated dependencies [665b483]
  - @inox-tools/modular-station@0.1.1

## 0.2.1

### Patch Changes

- 150a2b8: Fix resolution of manually defined fancy collections

## 0.2.0

### Minor Changes

- 652f871: Rename `injectContent` to `injectCollections`

### Patch Changes

- dffe181: Add `seedCollections` utility and `seedTemplateDirectory` option to `injectCollections`.
- 652f871: Re-organized internal types

## 0.1.0

### Minor Changes

- 9384c4f: Initial package release with `injectCollection` utility

### Patch Changes

- Updated dependencies [2ff09d8]
  - @inox-tools/utils@0.1.1
