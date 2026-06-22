#!/usr/bin/env bash

set -euxo pipefail

export CI=1

PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

# Unstage any changes
git restore --staged .
git restore .
git switch main
git pull --rebase --autostash origin main

UPDATE_BRANCH="chore/upgrade-dependencies"

# Delete upgrade branch if it exists, we are creating a new one
git branch -D "$UPDATE_BRANCH" "$UPDATE_BRANCH-major" || true

# Create and switch to branch
git switch -c "$UPDATE_BRANCH" || true

# Update to latest pnpm
corepack use pnpm@latest

# Relock dependencies
pnpm upgrade -r --no-save
pnpm dedupe
nix flake update

git add package.json pnpm-lock.yaml flake.lock || true
if git commit -m "chore: Relock dependencies" -- package.json pnpm-lock.yaml flake.lock; then
  git push --set-upstream origin "$UPDATE_BRANCH" --force
  gh pr create \
    --title "chore: Relock dependencies" \
    --body "" || true

  gh pr merge --auto --rebase --body='' --subject "chore: Relock dependencies"
fi

# Create and switch to branch
git switch -c "$UPDATE_BRANCH-major" || true

# Upgrade all dependencies breaking
pnpm upgrade -r --latest
pnpm dedupe

AFFECTED_PACKAGES=$(git diff pnpm-workspace.yaml |
  rg '\+  (.*):.*' -r '$1' |
  xargs pnpm why -r --prod --json |
  jq -r '[.[].name|select(startswith("@inox-tools/"))|{name:.,value:"minor"}]|from_entries' |
  yq -P)

CHANGESET=".changeset/$(uuid || uuidgen).md"

cat <<EOF >"$CHANGESET"
---
${AFFECTED_PACKAGES}
---

Updated dependencies
EOF

git add '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml || true
if git commit -m "chore!: Upgrade dependencies" \
  -- '**/package.json' "$CHANGESET" package.json pnpm-lock.yaml pnpm-workspace.yaml; then
  git push --set-upstream origin "$UPDATE_BRANCH-major" --force
  gh pr create \
    --title "chore!: Upgrade dependencies" \
    --body "" || true
fi
