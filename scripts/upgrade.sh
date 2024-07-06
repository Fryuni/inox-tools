#!/usr/bin/env bash

set -exo pipefail

corepack use pnpm@latest

# Upgrade all prod dependencies
pnpm upgrade -rLP

# Do not bump prod dependencies on packages
git restore packages

# Upgrade all dev dependencies
pnpm upgrade -rLD
pnpm dedupe

git add '**/package.json' package.json pnpm-lock.yaml
git commit -m "chore: Upgrade dependencies"
