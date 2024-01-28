---
title: 'Features'
description: 'Current and planned features for the Inline Virtual Module package.'
---

## Work-in-Progress features

Here are some features that are intended to be supported but are currently not behaving correctly.

Using such cases in your inline modules _will not_ give you any warnings, since we cannot detect those misbehaviors ourselves at the moment.

### Circular Arrays

```ts
const array = [];
array.push(array);

inlineMod({
    defaultExport: array,
});
```

### Arrays with non-identifier custom properties

```ts
const array = [];
(array as any)['weird:prop'] = 'bar';

inlineMod({
    defaultExport: array,
});
```

