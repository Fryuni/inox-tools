---
'@inox-tools/route-config': patch
'@inox-tools/sitemap-ext': patch
---

Fix SSR route-config callback loading during pure server builds so sitemap-ext can include URLs when Astro skips the static generation hook.
