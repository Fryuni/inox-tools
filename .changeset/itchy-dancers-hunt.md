---
"@inox-tools/inline-mod": patch
---

Optimizes serialization of non-capturing functions.

Previously, non-capturing functions would be serialized to this:
```js
function __f0() {
  return (function() {
    return () => "read value";
  }).apply(undefined, undefined).apply(this, arguments);
}
```

Now it is serialized to this:
```js
const __f0 = () => "read value";
```

