#!/usr/bin/env bash

set -exo pipefail

export CI=1

PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

# Unstage any changes
git restore --staged .

# Switch to main
git switch main
git pull origin main --rebase

# Delete upgrade branch if it exists, we are creating a new one
git branch -D chore/upgrade-dependencies || true

# Update to latest pnpm
corepack use pnpm@latest

# Relock dependencies
pnpm upgrade -r --no-save
pnpm dedupe
nix flake update

git add package.json pnpm-lock.yaml flake.lock || true
git commit -m "chore: Relock dependencies" -- package.json pnpm-lock.yaml flake.lock || true

# Upgrade all dependencies non-breaking
pnpm upgrade -r
pnpm dedupe

if pnpm test && pnpm build:examples && pnpm -r --filter docs build && pnpm test:e2e; then
  echo "All tests passed, safe to commit directly"
else
  echo "Tests failed, commiting changes to a branch for manual review"
  # Create and switch to branch
  git switch -c chore/upgrade-dependencies
fi

git add '**/package.json' package.json pnpm-lock.yaml pnpm-workspace.yaml || true
git commit -m "chore: Upgrade dependencies non-breaking" \
  -- '**/package.json' package.json pnpm-lock.yaml pnpm-workspace.yaml || true

# Upgrade all dependencies breaking
pnpm upgrade -r --latest
pnpm dedupe

AFFECTED_PACKAGES=$(git diff pnpm-workspace.yaml |
  rg '\+  (.*):.*' -r '$1' |
  xargs pnpm why -r --prod --json |
  jq -r '[.[].name|select(startswith("@inox-tools/"))|{name:.,value:"minor"}]|from_entries' |
  yq -P)

CHANGESET=".changeset/$(uuid).md"

cat <<EOF >"$CHANGESET"
---
${AFFECTED_PACKAGES}
---

Updated dependencies
EOF

# If current branch is main
if [ "$(git branch --show-current)" = "main" ]; then
  if pnpm test && pnpm build:examples && pnpm -r --filter docs build && pnpm test:e2e; then
    echo "All tests passed, safe to commit directly"
  else
    echo "Tests failed, commiting changes to a branch for manual review"
    # Create and switch to branch
    git switch -c chore/upgrade-dependencies || true
  fi
fi

git add '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml || true
git commit -m "chore!: Upgrade breaking dependencies" \
  -- '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml || true
