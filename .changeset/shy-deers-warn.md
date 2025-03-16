---
'@inox-tools/astro-tests': patch
---

Add methods to read binary files using a test fixture.

The existing `readFile` and `readSrcFile` methods retain their behavior, reading files as strings,
but now also accept an optional `encoding` parameter to change how the file is decoded into a string.

Two new methods, `readFileAsBuffer` and `readSrcFileAsBuffer` mirror the existing `readFile` and `readSrcFile` methods,
but return a `Buffer` object containing the raw bytes read from the file.
