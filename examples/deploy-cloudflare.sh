#!/usr/bin/env bash

############################################
# Build an Astro Site to Cloudflare Workers #
############################################

set -exo pipefail

PROJECT_NAME=$1
WORKER_NAME="inox-tools-ex-$PROJECT_NAME"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Check that the project exists
if [ ! -d "$SCRIPT_DIR/$PROJECT_NAME" ]; then
	echo "Project $PROJECT_NAME does not exist" >&2
	exit 1
fi

cd "$SCRIPT_DIR/$PROJECT_NAME"

# Check that the project is an Astro project
if ! jq -e '.dependencies | has("astro")' package.json >/dev/null; then
	echo "Project $PROJECT_NAME is not an Astro project" >&2
	exit 1
fi

# Set a valid worker name in package.json before astro add (the Cloudflare
# Vite plugin and astro add both read the name from package.json)
jq --arg name "$WORKER_NAME" '.name = $name' package.json >package.json.tmp && mv package.json.tmp package.json

# Configure the Astro project to deploy to Cloudflare Workers
pnpm astro add cloudflare --yes
pnpm add @astrojs/cloudflare@latest

# Overwrite the generated wrangler config with our template
cp "$SCRIPT_DIR/wrangler-template.json" wrangler.jsonc
jq --arg name "$WORKER_NAME" '. + {name: $name}' wrangler.jsonc >wrangler.jsonc.tmp && mv wrangler.jsonc.tmp wrangler.jsonc

# Build the project
pnpm astro build
