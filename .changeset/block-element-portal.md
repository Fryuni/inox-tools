---
"@inox-tools/portal-gun": patch
---

Fixed portals placed inside inline elements (like `<p>` tags) when the portal content contains block elements (like `<div>`).

Previously, using a custom element tag for portal entries caused HTML parsers to treat the portal as an inline element, leading to malformed HTML when block elements were sent through the portal. Now portal entries use a `<div>` placeholder with a data attribute, which correctly handles the block-in-inline parsing behavior.

Note: When a block element inside a portal causes it to be moved out of an inline element, the inline element will be split, leaving empty tags (e.g., `<p></p><p></p>`). This is standard HTML parsing behavior and matches how MDX handles components alone in their lines. If this is undesired, consider using a plugin or a separate middleware to remove consecutive empty `<p>` tags.

Fixes #257
