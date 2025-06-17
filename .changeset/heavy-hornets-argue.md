---
'@inox-tools/utils': minor
---

Fix type narrowing when using equality test on unist visitor

This may break some scenarios where equality test is used inline for a generic property of a Node:
```ts
visitParents({
  tree,
  // This previously was inferred as `{value: string}`, now it is inferred as `{value: 'foo'}`
  // which will narrow down the Node type to `never` if none of the Node types have `'foo'` as a type literal
  test: {
    value: 'foo',
  },
});


visitParents({
  tree,
  // To return the previous behavior while still using an inline constant, add the non-literal type within <> before the value
  // to declare it shouldn't be const-inferred.
  test: {
    value: <string>'foo',
  },
});
```
