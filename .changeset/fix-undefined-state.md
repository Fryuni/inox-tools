---
"@inox-tools/request-state": patch
---

Fixed setting state to `undefined`. Previously, setting a state value to `undefined` would delete the key from the state map, making it indistinguishable from uninitialized state on the client side. This caused errors like "tried to use store before initialization" when using patterns like `$store.set(product?.specialOffer)` where the value might be `undefined`.

Now explicit `undefined` values are properly serialized and deserialized using `devalue`, allowing `hasState()` to return `true` and `getState()` to return `undefined` for explicitly set undefined values.
