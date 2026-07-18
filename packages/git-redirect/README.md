<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Astro Git Redirect

Create Astro redirects from the Git rename history of your pages.

## Install

```sh
npm i @inox-tools/git-redirect
```

Add the integration to your `astro.config.mjs`:

```js
// astro.config.mjs
import { defineConfig } from 'astro';
import gitRedirect from '@inox-tools/git-redirect';

export default defineConfig({
  integrations: [
    gitRedirect([
      { path: 'src/pages', prefix: '/' },
      { path: 'content/guides', prefix: '/guides' },
    ]),
  ],
});
```

## Sources

`gitRedirect()` accepts an ordered array of sources. Each source has a `path` and a `prefix`:

- `path` must be an existing file or directory. Relative paths resolve from the Astro project root; absolute paths are also supported. The path must be inside a Git repository.
- `prefix` is the URL base for the source. It is normalized to a leading slash with trailing slashes removed, except for `/`.

A directory source recursively considers supported pages within that directory. A file source only considers that current file and its rename history; its routes are relative to the file's parent directory. Redirects are generated only for `.astro`, `.md`, and `.mdx` files whose current target still exists.

For both old and current paths, the extension is removed and a terminal `index` segment is collapsed. For example, with `{ path: 'content/guides', prefix: '/guides' }`, renaming `content/guides/old/index.md` to `content/guides/getting-started.mdx` creates `/guides/old` → `/guides/getting-started`.

All names in a rename chain redirect to the current page.

## Redirect precedence

The integration never replaces an existing route or an explicit Astro redirect. If generated redirects collide, sources are processed in configuration order and the earlier source wins.

Dynamic routes are redirected only when their parameter bindings are identical and in the same order. For example, `[id]/old.md` can redirect to `[id]/current.md`, but `[id].md` does not redirect to `[slug].md`, and `[...parts].md` does not redirect to `[parts].md`.

Nested Git repositories are ignored when walking a directory source. Configure a nested repository as its own source to generate its redirects.

## Git history

For every configured source, the integration finds its containing repository and inspects the first-parent rename history at `HEAD`, once per repository. Complete Git history is required: shallow repositories fail the build. In GitHub Actions, configure checkout with `fetch-depth: 0`.

### License

Astro Git Redirect is available under the MIT license.
