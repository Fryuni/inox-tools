---
title: Lazy values
sidebar:
  order: 2
  badge:
    text: ADVANCED
    variant: danger
---

:::danger
Lazy values are an advanced utility, misuse of this feature may cause deadlocks, infinite recursions or even serialization of unsafe values.
In most cases, [`asyncFactory`](/inline-mod/factory-wrappers#asyncfactory) is a better choice.

Make sure your use case comply with all the [requirements](#requirements) laid out on this page.
:::

Sometimes you can only get a value after the module where it should be serialized to is created. When using the [AIK Plugin](/inline-mod/aik-plugin), for example, you can only define an inline module during the `astro:config:setup` hook, but you might want to serialize a value from other hooks.

For such use cases, you can use the `lazyValue` utility to create a placeholder value that you can set later:

```ts
import { lazyValue } from '@inox-tools/inline-mod';
import { defineModule } from '@inox-tools/inline-mod/vite';

const value = lazyValue();

defineModule('virtual:your-plugin/config', {
  constExports: { value },
});

value.set('hello');
```

## Under the hood

Internally this utility will park the module inspection and serialization in Node's event loop such that it can be resumed once, and only once, the value of the lazy value is set.
This allows for as much of the inspection/serialization work to be done preemptively, and not wait for the value to be set.

During the module resolution, anything awaiting on the `load` event of the virtual module will also be parked until the value is set.

## Requirements

When using `lazyValue` you must provide the following guarantees:

- The value is set on all possible code paths
- The value is set before Vite's bundling is expected to complete (and here we say expected because if you don't set the value, Vite will never complete the bundling)
- The value being set does not depend on resolving the serialization of the value (neither directly or indirectly)
