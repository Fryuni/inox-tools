#!/usr/bin/env bash

set -exo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

corepack use pnpm@latest

# Upgrade all prod dependencies
pnpm upgrade -rLP

# Do not bump prod dependencies on packages
git restore packages

# Upgrade all dev dependencies
pnpm upgrade -rLD

rm -rf .inox-tools
mkdir -p .inox-tools/catalogs/default
cat >.inox-tools/pnpm-workspace.yaml <<EOF
packages:
  - 'catalogs/*'
EOF
cat >.inox-tools/package.json <<EOF
{"name": "root"}
EOF

yq '.catalog' pnpm-workspace.yaml -oj |
  jq '{name:"default",dependencies:.}' \
    >.inox-tools/catalogs/default/package.json

catalogs=$(echo "$CATALOGS" | tr ',' ' ')

for catalog in $catalogs; do
  mkdir -p ".inox-tools/catalogs/$catalog"
  yq '.catalogs' pnpm-workspace.yaml -oj |
    jq --arg catalog "$catalog" \
      '{name:$catalog,dependencies:.[$catalog]}' \
      >".inox-tools/catalogs/$catalog/package.json"
done

pnpm upgrade -C .inox-tools -rL

yq . pnpm-workspace.yaml -oj -i

jq --slurpfile pack .inox-tools/catalogs/default/package.json \
  '.catalog |= (
    to_entries
    | [
      .[]
      |(.value=$pack[0].dependencies[.key])
    ]
    | from_entries
  )' pnpm-workspace.yaml | sponge pnpm-workspace.yaml

for catalog in $catalogs; do
  mkdir -p ".inox-tools/catalogs/$catalog"
  jq --slurpfile pack ".inox-tools/catalogs/$catalog/package.json" \
    --arg catalog "$catalog" \
    '.catalogs[$catalog] |= (
      to_entries
      | [
        .[]
        |(.value=$pack[0].dependencies[.key])
      ]
      | from_entries
    )' pnpm-workspace.yaml | sponge pnpm-workspace.yaml
done

rm -rf .inox-tools

yq . pnpm-workspace.yaml -oy -i -P

pnpm dedupe

# git add '**/package.json' package.json pnpm-lock.yaml pnpm-workspace.yaml
# git commit -m "chore: Upgrade dependencies"
