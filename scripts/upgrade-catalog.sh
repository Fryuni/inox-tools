#!/usr/bin/env bash

set -exo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

corepack use pnpm@latest

# Relock dependencies
pnpm upgrade -r --no-save
pnpm dedupe

git add pnpm-lock.yaml || true
git commit -m "chore: Relock dependencies" -- pnpm-lock.yaml || true

# Upgrade all dependencies breaking
pnpm upgrade -r --latest
pnpm dedupe

AFFECTED_PACKAGES=$(git diff pnpm-workspace.yaml |
  rg '\+  (.*):.*' -r '$1' |
  xargs pnpm why -r --json |
  jq -r '[.[].name|select(startswith("@inox-tools/"))|{name:.,value:"minor"}]|from_entries' |
  yq -P)

CHANGESET=".changeset/$(uuid).md"

cat <<EOF >"$CHANGESET"
---
${AFFECTED_PACKAGES}
---

Updated dependencies
EOF

git add '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml || true
git commit -m "chore: Upgrade dependencies" \
  -- '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml || true
