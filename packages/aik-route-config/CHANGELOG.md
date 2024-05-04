# @inox-tools/aik-route-config

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
