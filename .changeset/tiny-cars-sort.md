---
'@inox-tools/request-state': patch
---

Added calculation of the `Content-Length` header when opting out of streaming with an injected state.
This ensures responses with an injected state include the correct `Content-Length` header.
Unmodified responses (like `HEAD` or `304 Not Modified`) continue to work exactly as before, avoiding overwriting the existing `Content-Length` header with an empty size.
