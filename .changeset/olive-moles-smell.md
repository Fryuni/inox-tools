---
'@inox-tools/astro-when': patch
---

Fixes projects with `output: 'static'` being flagged as `StaticOutput` even when an adapter is present.

Previously, using this was the explicit `output: 'hybrid'`, now this mode is set by the presence of an adapter.
