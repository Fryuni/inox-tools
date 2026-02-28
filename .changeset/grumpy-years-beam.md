---
'@inox-tools/utils': patch
---

Declare static constructors of `Lazy` and `LazyKeyed` to take `this: void` so typescript strictest modes allow passing those functions as values without rebinding.
