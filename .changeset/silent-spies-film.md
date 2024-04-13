---
"@inox-tools/aik-mod": patch
---

Fixes a type issue with `DeepPartial`

The `DeepPartial` type utility from `astro` was being inlined in the `aik-mod` package without being exported, preventing integrations using `aik-mod` from having a named type.
