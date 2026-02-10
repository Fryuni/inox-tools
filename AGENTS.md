# INOX-TOOLS

**Generated:** 2026-02-09 | **Commit:** 771ef53 | **Branch:** main

## OVERVIEW

pnpm monorepo of 19 `@inox-tools/*` packages — Astro integrations, Vite plugins, and utilities. Built with Turbo, tsup, TypeScript strict mode. Author: Luiz Ferraz (Fryuni).

## STRUCTURE

```
inox-tools/
├── packages/           # 19 @inox-tools/* packages (the product)
│   ├── utils/          # Foundational: Lazy, Once, unist visitor (16+ consumers)
│   ├── inline-mod/     # Most complex: closure serialization via V8 introspection
│   ├── modular-station/# Integration hook system (withApi, onHook)
│   ├── runtime-logger/ # Build→runtime logger bridging
│   ├── astro-tests/    # Test harness (loadFixture, testAdapter)
│   ├── request-state/  # AsyncLocalStorage request-scoped state
│   ├── request-nanostores/ # Nanostores + request-state (auto-injects dep)
│   ├── content-utils/  # Content collections + git tracking
│   ├── portal-gun/     # HTML element transport via portals
│   ├── cut-short/      # Early request termination
│   ├── server-islands/ # Server island utilities
│   ├── aik-mod/        # AIK wrapper for inline-mod
│   ├── aik-route-config/# Per-route configuration
│   ├── astro-when/     # Lifecycle detection
│   ├── custom-routing/ # File-based routing override
│   ├── star-warp/      # Pagefind search integration
│   ├── sitemap-ext/    # Sitemap extension (entry at root index.ts, not src/)
│   ├── velox-luna/     # CLI tool for Lunaria i18n
│   └── dev-timings/    # Dev timing instrumentation
├── examples/           # 11 demo Astro projects
├── docs/               # Starlight documentation site
├── turbo/              # Turbo generators for scaffolding new packages
├── patches/            # astro.patch applied at install
└── scripts/            # Build utilities
```

## WHERE TO LOOK

| Task                 | Location                                      | Notes                                                               |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Add new integration  | `turbo gen` → `turbo/generators/integration/` | Handlebars templates scaffold full package                          |
| Add new Vite plugin  | `turbo gen` → `turbo/generators/vite-plugin/` | Separate template set                                               |
| Shared utilities     | `packages/utils/src/`                         | Import as `@inox-tools/utils/lazy`, `@inox-tools/utils/values` etc. |
| Test utilities       | `packages/astro-tests/`                       | `loadFixture()`, `testAdapter()`                                    |
| Virtual module types | `packages/*/virtual.d.ts`                     | All use `@it-astro:*` namespace                                     |
| Package deps catalog | `pnpm-workspace.yaml` `catalog:` section      | Single source of truth for versions                                 |
| Astro patch          | `patches/astro.patch`                         | Applied automatically at install                                    |

## DEPENDENCY TIERS (no circular deps)

```
T1 Foundation:  utils (0 deps, 16 consumers), inline-mod
T2 Infra:       modular-station → utils, runtime-logger → modular-station
T3 Features:    request-state, portal-gun, cut-short, server-islands → utils
T4 Composed:    request-nanostores → request-state, content-utils → modular-station
T5 Wrappers:    aik-mod → inline-mod, sitemap-ext → aik-route-config
```

## CONVENTIONS

### Code Style

- Prettier copied from Astro: **tabs** for code, **spaces** for JSON/YAML/MD
- Print width: 100, single quotes, trailing commas (es5)
- `prettier-plugin-astro` for .astro files
- Pre-commit hook via husky + lint-staged

### TypeScript

- Base config: `tsconfig.base.json` — strict, ES2022, Node16 resolution
- `verbatimModuleSyntax: true` — use `import type` explicitly
- All packages extend `../../tsconfig.base.json`

### Package Pattern

- Entry: `src/index.ts` (exception: `sitemap-ext` uses root `index.ts`)
- Build: `tsup` → `dist/` for every package
- Exports: Conditional `types` + `default` in package.json `exports` field
- Files shipped: `dist`, `src`, `virtual.d.ts`

### Integration Pattern (ALL Astro integrations follow this)

- Use `defineIntegration()` from `astro-integration-kit`
- Virtual modules via `@it-astro:*` namespace with `virtual.d.ts` for types
- Middleware via `src/runtime/middleware.ts` for request-scoped logic
- Multi-plugin Vite chains for orthogonal concerns

### Versioning

- Changesets for semver + changelog
- `pnpm run version` → `changeset version && pnpm install && pnpm format`
- `pnpm cut-release` → `pnpm build && changeset publish`

## TESTING

- **Unit**: Vitest with `jest-extended` matchers (via `vitest.setup.ts` in each package)
- **E2E**: Playwright (request-state, request-nanostores, server-islands)
- **Fixtures**: Embedded Astro projects in `tests/fixture/` and `e2e/fixture/`
- **Harness**: `@inox-tools/astro-tests` provides `loadFixture()` + `testAdapter()`
- **Naming**: Unit = `*.test.ts`, E2E = `*.spec.ts` (exception: request-nanostores E2E uses `.test.ts`)
- **Parallelism**: `fileParallelism: false` in most vitest configs; turbo runs tests with `--concurrency=1`
- **Coverage**: `vitest run --coverage` for utils, inline-mod, aik-route-config, cut-short

## COMMANDS

```bash
pnpm install                    # Install all deps (postinstall generates turbo cache key)
pnpm build                      # Build all @inox-tools/* packages
pnpm build:examples             # Build example projects
pnpm test                       # Unit tests (sequential via turbo)
pnpm test:e2e                   # Playwright E2E tests
pnpm format                     # Prettier format all files
pnpm format --check             # CI lint check
pnpm cut-release                # Build + changeset publish
turbo gen                       # Scaffold new package from templates
```

## ANTI-PATTERNS

- No HACK/DEPRECATED/WARNING comments in codebase — only TODOs for incomplete features
- `inline-mod` closure engine derived from Pulumi (Apache 2.0) — respect attribution
- Tests are sequential by design (shared fixtures) — do not add `--parallel`
- `custom-routing`: Cannot use inline API routes until Astro core supports virtual modules for routes
- `content-utils/injector.ts`: Missing collision detection between integrations (3 TODOs)

## CI

- GitHub Actions: build (Node 20+22) → lint → test → e2e → dedupe check
- Build timeout: 3min, test timeout: 25min
- `pkg-pr-new` publishes preview releases on every commit
- Changesets auto-creates release PRs on main

## NOTES

- `astro` is patched via `patches/astro.patch` — check compatibility on Astro upgrades
- Nix flake available for dev environment (`flake.nix`)
- `inline-mod/src/closure/entry.test.ts` is colocated with source (only exception to test separation)
- `star-warp/routes/*` exports point to source files directly (not dist)
- Node 22+ recommended (CI matrix: 20, 22)
