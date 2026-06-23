# docs/scripts

## `index-orama.mjs`

Post-build step that pushes the generated static HTML into our Orama Cloud
project. It runs automatically at the tail end of `pnpm --filter docs build`
(see `docs/package.json`).

### Env vars

| Variable                      | Where                            | What                                                             |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `ORAMA_CLOUD_PROJECT_ID`      | `.env.production` (public)       | Same project id used by the search UI.                           |
| `ORAMA_CLOUD_DATASOURCE_ID`   | `.env.production` (public)       | REST API data source id of the collection to reindex.            |
| `ORAMA_CLOUD_PRIVATE_API_KEY` | **Vercel secret (never commit)** | Write-scoped Orama Cloud key. Required for a real ingestion run. |

If `ORAMA_CLOUD_PRIVATE_API_KEY` is absent the script logs a warning and exits
zero — so branch / preview deployments without the secret do not fail the build.

### Add the private key to Vercel

```sh
# From the repo root, with the Vercel CLI logged in and linked to the project.
vercel env add ORAMA_CLOUD_PRIVATE_API_KEY production
# Paste the write-scoped key when prompted.
```

Repeat for `preview` / `development` only if you want PR deploys to also
refresh the index.

### Running locally

Dry run (extracts docs, prints stats, touches no remote state):

```sh
cd docs
pnpm astro build
node ./scripts/index-orama.mjs --dry-run
```

Real run (requires the private key to be exported in the shell):

```sh
ORAMA_CLOUD_PRIVATE_API_KEY=… node ./scripts/index-orama.mjs
```
