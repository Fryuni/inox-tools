---
'@inox-tools/request-nanostores': minor
'@inox-tools/request-state': minor
---

Adds support for partial pages.

Previously, state was added at the end of the body to be loaded once for the duration of the page view. During transitions using `<ClientRouter />`, the entire state was reloaded from the new document.
Partial pages (pages in Astro using `export const partial = true`), do not generate a head or a full body. They are used in conjunction with client-side code to update just a portial of an already opened page with new HTML nodes. State generated on the server in requests to such partial pages was lost since there was no "end of body" in the response on which to attach the state.

Now, state is generate at the end of the each request, even if there is on "end of body". The client-side code is updated to read new state (that hasn't yet been loaded into the page) from the document upon access. This allows a partial replacement of the DOM containing new state annotations that will be loaded once they are accessed.

Conflicting state is not replaced, the first value that is sent to the client is the one kept on the client until the user navigates to a different page. So state from a partial page request may _add_ entries to the page state, but not _remote_ nor _update_ them. In the future, we may add options to make this behavior configurable.
