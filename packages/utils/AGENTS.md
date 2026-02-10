# UTILS

Foundational utilities with zero dependencies. Consumed by 16+ packages — changes cascade widely.

## STRUCTURE

```
src/
├── lazy.ts         # Lazy<T>, LazyKeyed<T> — deferred memoized values (388 lines)
├── once.ts         # Once — single-execution guarantee with key-based memoization
├── values.ts       # MaybeThunk<T>, resolveValue() — value-or-factory pattern
├── types.ts        # Prettify<T> — type flattening for IDE display, UnwrapLazies
└── unist/
    └── visit.ts    # Tree visitor for UNIST AST nodes (332 lines)
```

## KEY APIS

### Lazy\<T\>

- Deferred computation, memoized on first access
- **Implements full Promise interface** — can be `await`ed directly
- Circular dependency detection (throws if accessed during creation)
- `attach(name, callback)` — side effects on resolution
- `chain(fn)` — compose lazy values
- Static: `Lazy.of()`, `Lazy.from()`, `Lazy.join()`

### LazyKeyed\<T\>

- Key-indexed variant of Lazy — `get(key)` returns memoized value per key
- Same Promise interface per key

### Once

- Execute a function at most once, cache result
- Key-based: different keys = different executions

### visit()

- UNIST-compatible tree traversal with parent tracking
- Actions: `SKIP`, `CONTINUE`, `EXIT`, `REMOVE`
- Supports reverse traversal order

## TESTING

- `tests/lazy.test.ts` (539 lines) — Promise behavior, circular deps, chaining, attachments
- `tests/unist/visit.test.ts` (667 lines) — all traversal modes, parent tracking, edge cases
- Tests are larger than source (2x coverage ratio) — these modules handle many edge cases
- `vitest run --coverage`

## EXPORTS

Wildcard submodule pattern — import individual utilities:

```typescript
import { Lazy } from '@inox-tools/utils/lazy';
import { resolveValue } from '@inox-tools/utils/values';
import { visit, SKIP, EXIT } from '@inox-tools/utils/unist';
```

## NOTES

- Breaking changes here affect 16+ packages — test thoroughly
- `Lazy` Promise interface means `instanceof Promise` returns false but `await` works
- `visit()` follows `unist-util-visit` conventions but with typed parent tracking
