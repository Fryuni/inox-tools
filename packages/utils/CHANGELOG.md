# @inox-tools/utils

## 0.3.0

### Minor Changes

- 21e0744: Bump support to Vite 6
- 21e0744: Add utility for setting deeply nested values through optional fields

## 0.3.0-beta.0

### Minor Changes

- b4843b9: Bump support to Vite 6
- b4843b9: Add utility for setting deeply nested values through optional fields

## 0.2.0

### Minor Changes

- e07b8a8: Add unist visitor with support for postorder traversal

## 0.1.4

### Patch Changes

- b53264e: Add utilities for handling values with different guarantees.

  - `MaybePromise` for values that can be immediate or delayed in a Promise;
  - `MaybeThunk` for values that can be immediate or created on demand;
  - `MaybeAsyncThunk` for values that can be immediate or created on demand and the value may be in a Promise.

## 0.1.3

### Patch Changes

- b4d7a16: Fixes `Once` utility and add support for async callbacks
- f4c2ddb: Migrate to pnpm catalogs for consistency across packages

## 0.1.2

### Patch Changes

- f133739: Add `Prettify` utility type

## 0.1.1

### Patch Changes

- 2ff09d8: Add new `Once` utility

## 0.1.0

### Minor Changes

- 0b348fd: Extract utilities into a shared package
