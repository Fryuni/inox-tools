# @inox-tools/inline-mod

## 1.2.0

### Minor Changes

- a4046d5: Propagate factory construction across Promise resolution
- e830a7e: Move experimental support for mixed ESM imports behind env var

## 1.2.0-beta.0

### Minor Changes

- 8cee245: Propagate factory construction across Promise resolution

### Patch Changes

- e830a7e: Move experimental support for mixed ESM imports behind env var

## 1.1.2

### Patch Changes

- ddae7b7: Add support for non-valid identifier exports
- 0bcfffe: Export module definition type

## 1.1.1

### Patch Changes

- 23dea8c: Fix handling of mixed CJS and ESM imports
- 040d148: Fix serialization of native Date values
- c0d3cc5: Handle corner case of dependency import detection

## 1.1.0

### Minor Changes

- d430acc: Add support for serializing URL objects
- 8aca13a: Implement support for async magic factory
- db4e594: Add new factory utility

### Patch Changes

- 645a2e4: Handle import errors on cache build
- 1daa274: Add support for debugging and inspecting generated modules
- 5093c2d: Allow updating module resulution in DEV environment
- 2e7a6af: Fix dependency import path search

## 1.1.0-smart-factory.4

### Patch Changes

- bd29c64: Allow updating module resulution in DEV environment

## 1.1.0-smart-factory.3

### Minor Changes

- d430acc: Add support for serializing URL objects

### Patch Changes

- 645a2e4: Handle import errors on cache build
- 2e7a6af: Fix dependency import path search

## 1.1.0-smart-factory.0

### Minor Changes

- 8aca13a: Implement support for async magic factory
- db4e594: Add new factory utility

## 1.0.1

### Patch Changes

- 3bf3825: Add support for referring to named exports instead of serializing them recursivelly

## 1.0.0

### Major Changes

- 76c0978: Complete first release with stable API

## 0.1.5

### Patch Changes

- b4b4ab1: Optimizes serialization of non-capturing functions.

  Previously, non-capturing functions would be serialized to this:

  ```js
  function __f0() {
    return function () {
      return () => 'read value';
    }
      .apply(undefined, undefined)
      .apply(this, arguments);
  }
  ```

  Now it is serialized to this:

  ```js
  const __f0 = () => 'read value';
  ```

- 1b3919f: Fix support for circular values

## 0.1.4

### Patch Changes

- 71fcbe5: Fix support for sparse arrays
- 2230d1d: Add general support for serializing symbols
- 9fc3942: Fix support for custom object property descriptors

## 0.1.3

### Patch Changes

- ecdd836: Fix license on published package

## 0.1.2

### Patch Changes

- 1bbc192: Update README
- c498686: Fix warnings due to tsup minifier

## 0.1.1

### Patch Changes

- 6dd5b5c: Update README shield

## 0.1.0

### Minor Changes

- 3d16a70: Minimal working version

### Patch Changes

- 3d16a70: Fix dynamic import warning

## 0.0.1

### Patch Changes

- c7a6583: Initial test release
