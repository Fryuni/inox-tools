# Inox-Tools Project Roadmap

## Current State

pnpm monorepo of 18 published `@inox-tools/*` packages (Astro integrations, Vite plugins, utilities) by Luiz Ferraz (Fryuni). Built with Turbo, tsup, TypeScript strict mode.

**Recent activity** is focused on the `utils` package — stabilizing its API (breaking change in 541ae07), adding auto-dependent computed atoms, improved Lazy utility, and batching support for `resolvedAtom`. There's a pending changeset for the batching feature (`cyan-beans-argue.md`).

The project is mature and in active maintenance. Most packages are stable with established patterns. The latest major chore was a full dependency upgrade (#263).

## Key Decisions Made

- Virtual modules use `@it-astro:*` namespace
- Changesets for versioning; `pkg-pr-new` for preview releases
- Sequential test execution (shared fixtures)
- `pnpm-workspace.yaml` catalog for centralized dependency versions
- `utils` API stabilized as of commit 541ae07 (breaking change)

## Milestones

### Completed

- Full dependency upgrade (#263)
- Utils API stabilization with auto-dependent computed atoms (#266)
- Batching support for `resolvedAtom` (77b0b6b, pending release)

### Planned

- Release pending changeset for utils batching feature
- Ongoing: content-utils collision detection (3 TODOs in injector.ts)

## Architecture Notes

- 5-tier dependency structure (Foundation → Wrappers), no circular deps
- `inline-mod` is the most complex package (V8 closure serialization, derived from Pulumi)
- `astro` is patched via `patches/astro.patch` — must check on Astro upgrades
