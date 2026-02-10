# INLINE-MOD

Serialize arbitrary JS values (functions, classes, closures) into importable ES modules at build time. Derived from Pulumi's closure serialization engine (Apache 2.0).

## ARCHITECTURE

3-phase pipeline: **Inspect → Parse → Serialize**

```
src/
├── index.ts              # Public API: factory(), asyncFactory(), lazyValue()
├── inlining.ts           # Orchestrator: inspectInlineMod() ties phases together
├── vite.ts               # Vite plugin: virtual module resolution + defineModule()
├── log.ts                # Debug logging
└── closure/              # Core engine (4100+ LOC)
    ├── inspectCode.ts    # Phase 1: Inspector class — walks V8 scope chains, builds Entry graph (1280 lines)
    ├── parseFunction.ts  # Phase 2: TS compiler API extracts captured variables from function source (943 lines)
    ├── serialization.ts  # Phase 3: ModuleSerializer emits ES module text from Entry graph (643 lines)
    ├── v8.ts             # V8 Inspector API wrapper — scope chains, internal properties (316 lines)
    ├── v8Hooks.ts        # Inspector session lifecycle management
    ├── entry.ts          # Entry registry — layered cache with fork() for isolation
    ├── entry.test.ts     # COLOCATED test (only exception in repo)
    ├── types.ts          # 15 Entry kinds: json, function, object, array, module, symbol, promise, factory...
    ├── package.ts        # Node package.json resolution + subpath exports
    ├── rewriteSuper.ts   # AST transform: super() → __super.call() for serialized classes
    └── utils.ts          # JS identifier validation
```

## KEY CONCEPTS

- **Entry**: Tagged union (15 kinds) representing any inspected JS value
- **Inspector**: Singleton class with global cache, context frames, super tracking
- **EntryRegistry**: Fork-able layered cache — prevents infinite recursion on circular refs
- **Magic Factory**: Proxy-based deferred evaluation — `factory(() => expr)` delays until first access
- **Module Detection**: Reverse cache maps runtime values back to their `import` source

## HOW IT WORKS

1. `factory(fn)` captures `fn` as a closure
2. Vite plugin calls `inspectInlineMod()` during module resolution
3. Inspector walks the closure's scope chain via V8 Inspector API
4. For each captured value: recursively inspect → detect if it's a module import or raw value
5. Parser extracts which variables the function body actually references
6. Serializer emits valid ES module text with IIFE-wrapped environment restoration

## WHERE TO LOOK

| Task                   | File                                          | Notes                                  |
| ---------------------- | --------------------------------------------- | -------------------------------------- |
| Add new Entry kind     | `closure/types.ts` + `closure/inspectCode.ts` | Add type + inspection logic            |
| Fix serialization bug  | `closure/serialization.ts`                    | `emitFunctionWorker()`, `emitObject()` |
| Debug scope capture    | `closure/v8.ts`                               | V8 `[[Scopes]]` introspection          |
| Fix function parsing   | `closure/parseFunction.ts`                    | TypeScript scanner/AST analysis        |
| Class inheritance bugs | `closure/rewriteSuper.ts`                     | super() → \_\_super rewriting          |
| Package resolution     | `closure/package.ts`                          | Node.js exports field handling         |

## TESTING

- 9 test suites in `tests/`: simple-values, functions, classes, objects, arrays, exportModes, specialValues, modules, js-syntax
- Pattern: `inspectInlineMod({ exports }) → verify .text matches expected code + .module.get() produces correct runtime value`
- Uses inline snapshots extensively (`toMatchInlineSnapshot`)
- `entry.test.ts` is colocated in `src/closure/` (only exception)

## ANTI-PATTERNS

- V8 Inspector sessions are expensive — reuse via `v8Hooks.ts` session management
- `inspectCode.ts` has 3 TODOs: function location reporting, object capture optimization, location info
- `package.ts` TODO: Node.js conditional exports not fully handled
- `v8Hooks.ts` TODO: Dev server cache clearing behavior untested
