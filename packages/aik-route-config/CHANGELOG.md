# @inox-tools/aik-route-config

## 0.7.5-beta.0

### Patch Changes

- Updated dependencies [b4843b9]
- Updated dependencies [b4843b9]
  - @inox-tools/utils@0.3.0-beta.0

## 0.7.4

### Patch Changes

- Updated dependencies [e07b8a8]
  - @inox-tools/utils@0.2.0

## 0.7.3

### Patch Changes

- Updated dependencies [b53264e]
  - @inox-tools/utils@0.1.4

## 0.7.2

### Patch Changes

- 8400096: Add debug logging

## 0.7.1

### Patch Changes

- 255d6ba: Relax peer dependency restriction on Astro

## 0.7.0

### Minor Changes

- 03369f7: Bump Astro version to 4.12

## 0.6.2

### Patch Changes

- f4c2ddb: Migrate to pnpm catalogs for consistency across packages
- Updated dependencies [b4d7a16]
- Updated dependencies [f4c2ddb]
  - @inox-tools/utils@0.1.3

## 0.6.1

### Patch Changes

- Updated dependencies [f133739]
  - @inox-tools/utils@0.1.2

## 0.6.0

### Minor Changes

- ebc7aa3: Bump Astro Integration Kit version

## 0.5.3

### Patch Changes

- 204b0ad: Fixes hoisting for routes not using the global `Astro` variable.

  When an Astro component doesn't use the `Astro` variable anywhere the `$createAstro` call is not emmited in the compiled source (https://github.com/withastro/compiler/commit/e8b6cdfc89f940a411304787632efd8140535feb). In that case use the `$createComponent` call as hoisting anchor instead.

## 0.5.2

### Patch Changes

- Updated dependencies [2ff09d8]
  - @inox-tools/utils@0.1.1

## 0.5.1

### Patch Changes

- 8f3f236: Fixes error on unexpected compiled Astro component structure

## 0.5.0

### Minor Changes

- b6d23ab: Updates the minimum supported version of Astro Integration Kit to `0.13.0`

## 0.4.2

### Patch Changes

- 8a4ed54: Bump all dependencies
- 8a4ed54: Expand support for AIK 0.11

## 0.4.1

### Patch Changes

- f36933d: The `DeepPartial` type utility from `astro` was being inlined in the `aik-route-config` package without being exported, preventing integrations using `aik-route-config` from having a named type.

## 0.4.0

### Minor Changes

- 49a8d88: Bump minimal AIK version to 0.10

## 0.3.1

### Patch Changes

- 1a47034: Adds a log message on errors to import SSR modules during build time

## 0.3.0

### Minor Changes

- a81f657: Update to AIK 0.8

## 0.2.0

### Minor Changes

- b5a53ab: Bump AIK to version 0.7
- a41cf48: Distribute built package

## 0.1.1

### Patch Changes

- 479abed: Fixes duplication of modules used in both server-side and client-side
- 479abed: Fix path normalization on context contruction to work on Windows
- 479abed: Disable warning during dev and preview server
- 479abed: Fixes incorrect assumption about imports that caused errors on files with import in script blocks

## 0.1.0

### Minor Changes

- 370c7c2: Handle use of magic imports in unsupported scopes
- 370c7c2: Initial development

### Patch Changes

- 8e8defe: Update dependencies
- 370c7c2: Handle async config definitions
- 370c7c2: Update READMEs

## 0.1.0-alpha.3

### Minor Changes

- e89d717: Handle use of magic imports in unsupported scopes

## 0.1.0-alpha.2

### Patch Changes

- 4439bf6: Handle async config definitions

## 0.1.0-alpha.1

### Patch Changes

- Update READMEs

## 0.1.0-alpha.0

### Minor Changes

- bcb30dc: Initial development
