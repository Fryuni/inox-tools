# main

**Purpose:** Main project memory branch

---

## Commit 5b55a084 | 2026-03-07T16:54:16.276Z

### Branch Purpose

Main project memory branch tracking the long-term evolution, architectural decisions, and current state of the inox-tools monorepo.

### Previous Progress Summary

Initial commit.

### This Commit's Contribution

- Established the Brain memory system for the monorepo to manage long-term agent context and roadmap.
- Synthesized current project state: 18+ Astro integrations and utilities in a Turbo-managed pnpm monorepo.
- Identified `@inox-tools/utils` as the current focus of active development, specifically API stabilization and reactive atom improvements.
- Documented key architectural decisions including the mandatory use of `defineIntegration` and the 5-tier dependency hierarchy.
- Captured core technical complexities such as the V8 closure serialization in `inline-mod` and the reliance on `patches/astro.patch`.
- Mapped project history into formal milestones, including the recent major dependency upgrade and pending release of batching support.
