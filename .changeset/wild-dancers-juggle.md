---
'@inox-tools/utils': patch
---

Add utilities for handling values with different guarantees.

- `MaybePromise` for values that can be immediate or delayed in a Promise;
- `MaybeThunk` for values that can be immediate or created on demand;
- `MaybeAsyncThunk` for values that can be immediate or created on demand and the value may be in a Promise.
