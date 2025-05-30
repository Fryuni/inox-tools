---
'@inox-tools/cut-short': minor
---

Implement `cancelPrerender` function, that allows a prerendered route to be skipped dynamically.

When skipped, the prerendered file won't be present in the final output. Requests to those paths will be handled by the hosting platform, possibly by the server if the project has server routes.
