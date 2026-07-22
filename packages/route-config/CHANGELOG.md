# @inox-tools/route-config

## 0.1.0

### Minor Changes

- 410697a: Require Astro 7 and Vite 8, dropping support for Astro 6 and Vite 7.

  All Inox Tools integrations now require Astro `^7` in their peer dependencies. Integrations that peer-depend on Vite now require Vite `^8`, matching the Vite version bundled by Astro 7. Additionally, `@inox-tools/star-warp` now requires Starlight `^0.41`.

  To migrate, upgrade your project to Astro 7 (see the [Astro 7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/)), which brings Vite 8 along. Starlight users must upgrade to `@astrojs/starlight` `^0.41`. No API changes were made to the integrations themselves; projects already on Astro 7 and Vite 8 can upgrade without code changes.

## 0.0.3

### Patch Changes

- 6674224: Adds support for Astro 7 and Vite 8 while retaining support for previously compatible versions. `@inox-tools/star-warp` also adds support for Starlight 0.41.

## 0.0.1 & 0.0.2

### Patch Changes

- 74ad4e5: Initial release

  This is a replacement for `@inox-tools/aik-route-config`.

- 025bb4d: Fix SSR route-config callback loading during pure server builds so sitemap-ext can include URLs when Astro skips the static generation hook.
