#!/usr/bin/env bash

set -euxo pipefail

export CI=1

PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

# Unstage any changes
git restore --staged .
git restore .
git switch main
git pull origin main

NON_BREAKING_BRANCH="chore/upgrade-non-breaking-dependencies"
BREAKING_BRANCH="chore/upgrade-dependencies"

# Delete upgrade branch if it exists, we are creating a new one
git branch -D "$NON_BREAKING_BRANCH" || true
git branch -D "$BREAKING_BRANCH" || true

# Update to latest pnpm
corepack use pnpm@latest

# Relock dependencies
pnpm upgrade -r --no-save
pnpm dedupe
nix flake update

git add package.json pnpm-lock.yaml flake.lock || true
git commit -m "chore: Relock dependencies" -- package.json pnpm-lock.yaml flake.lock || true

git push origin main

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

# Create and switch to branch
git switch -c chore/upgrade-dependencies || true

git add '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml || true
if git commit -m "chore!: Upgrade breaking dependencies" \
  -- '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml; then
  git push --set-upstream origin "$BREAKING_BRANCH" --force
  gh pr create \
    --title "chore!: Upgrade breaking dependencies" \
    --body "" || true
fi
