---
title: Lazy values
sidebar:
  order: 2
---

Sometimes you can only get a valye after the module where it should be serialized to is created. When using the [AIK Plugin](/inline-mod/aik-plugin), for example, you can only define an inline module during the `astro:config:setup` hook, but you might want to serialize a value from other hooks.

```ts
import { lazyValue } from '@inox-tools/inline-mod';
import { defineModule } from '@inox-tools/inline-mod/vite';

const remoteValue = lazyValue();

defineModule('virtual:your-plugin/config', {
  constExports: { value },
});

remoteValue.set('hello');
```

:::danger[VERY ADVANCED]
Lazy values are an advanced utility, misuse of this feature may cause dealocks, infinite recursions or even serialization of unsafe values.

In most cases, [`asyncFactory`](/inline-mod/factory-wrappers#asyncfactory) is a better choice.

Do not use them unless you know _FOR SURE_ that the value is _guaranteed to resolve_:

- Independently of the virtual source code of a module using the value
- Before the module is needed

:::
