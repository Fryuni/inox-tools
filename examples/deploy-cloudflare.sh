#!/usr/bin/env bash

###########################################
# Build an Astro Site to Cloudflare Pages #
###########################################

set -exo pipefail

PROJECT_NAME=$1

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Check that the project exists
if [ ! -d "$SCRIPT_DIR/$PROJECT_NAME" ]; then
	echo "Project $PROJECT_NAME does not exist" >&2
	exit 1
fi

cp "$SCRIPT_DIR/wrangler.toml" "$SCRIPT_DIR/$PROJECT_NAME/wrangler.toml"
echo "name = \"inox-tools-ex-$PROJECT_NAME\"" >>"$SCRIPT_DIR/$PROJECT_NAME/wrangler.toml"

cd "$SCRIPT_DIR/$PROJECT_NAME"

# Check that the project is an Astro project
if ! jq -e '.dependencies | has("astro")' package.json >/dev/null; then
	echo "Project $PROJECT_NAME is not an Astro project" >&2
	exit 1
fi

# Configure the Astro project to deploy to Cloudflare Pages
pnpm astro add cloudflare --yes

# Build the project
pnpm astro build

# Restore the Astro project to its original state
git restore package.json astro.config.*
