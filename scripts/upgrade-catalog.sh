#!/usr/bin/env bash

set -euxo pipefail

export CI=1

PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

# Unstage any changes
git restore --staged .

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

# Upgrade all dependencies non-breaking
pnpm upgrade -r
pnpm dedupe

if pnpm test && pnpm build:examples && pnpm -r --filter docs build && pnpm test:e2e; then
  echo "All tests passed, safe to commit directly"
else
  echo "Tests failed, commiting changes to a branch for manual review"
  # Create and switch to branch
  git switch -c "$NON_BREAKING_BRANCH"
fi

git add '**/package.json' package.json pnpm-lock.yaml pnpm-workspace.yaml || true
git commit -m "chore: Upgrade non-breaking dependencies" \
  -- '**/package.json' package.json pnpm-lock.yaml pnpm-workspace.yaml || true

if [ "$(git branch --show-current)" = "$NON_BREAKING_BRANCH" ]; then
  git push --set-upstream origin "$NON_BREAKING_BRANCH" --force
  gh pr create --draft \
    --title "chore: Upgrade non-breaking dependencies" \
    --body "" || true

  echo "On upgrade-non-breaking-dependencies branch, stopping here"
  exit 0
fi

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
git commit -m "chore!: Upgrade breaking dependencies" \
  -- '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml || true
