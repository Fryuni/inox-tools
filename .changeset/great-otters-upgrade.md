---
'@inox-tools/astro-tests': major
'@inox-tools/astro-when': major
'@inox-tools/custom-routing': major
'@inox-tools/cut-short': major
'@inox-tools/inline-mod': major
'@inox-tools/portal-gun': major
'@inox-tools/request-nanostores': major
'@inox-tools/request-state': major
'@inox-tools/runtime-logger': major
'@inox-tools/star-warp': major
'@inox-tools/content-utils': minor
'@inox-tools/modular-station': minor
'@inox-tools/route-config': minor
'@inox-tools/server-islands': minor
'@inox-tools/sitemap-ext': minor
---

Require Astro 7 and Vite 8, dropping support for Astro 6 and Vite 7.

All Inox Tools integrations now require Astro `^7` in their peer dependencies. Integrations that peer-depend on Vite now require Vite `^8`, matching the Vite version bundled by Astro 7. Additionally, `@inox-tools/star-warp` now requires Starlight `^0.41`.

To migrate, upgrade your project to Astro 7 (see the [Astro 7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/)), which brings Vite 8 along. Starlight users must upgrade to `@astrojs/starlight` `^0.41`. No API changes were made to the integrations themselves; projects already on Astro 7 and Vite 8 can upgrade without code changes.
