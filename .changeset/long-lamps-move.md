---
'@inox-tools/content-utils': patch
---

Adds support for Git information associated with entries using Content Layer loaders instead of only legacy collections.
Previously, git information was only available for collection entries made using the legacy behavior and only from the `src/content` directory.

Now it is available for collection entries made from any loader that populates `filePath` referring to a file within the project tree (within the direction containing the Astro config file).
