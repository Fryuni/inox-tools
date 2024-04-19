---
"@inox-tools/aik-route-config": patch
---

The `DeepPartial` type utility from `astro` was being inlined in the `aik-route-config` package without being exported, preventing integrations using `aik-route-config` from having a named type.
