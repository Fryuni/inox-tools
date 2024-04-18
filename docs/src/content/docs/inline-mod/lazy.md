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

When using `lazyValue` you must guarantee some invariants about the code using it. Failing to do so will cause serious problems in your project, ranging from deadlocks to unsafe code execution on your server.

### Set value on all possible code paths

There must not be any possible code path where a lazy value is not set.

#### Example

If the API call to the remote config fails or if the response is not valid JSON, the value will not be set.

```ts
import { lazyValue } from '@inox-tools/inline-mod';

const remoteConfig = lazyValue();

fetch('https://your.api.com/config')
  .then((res) => res.json())
  .then((config) => remoteConfig.set(config));
```

Do this instead:

```ts ins={9-13}
import { lazyValue } from '@inox-tools/inline-mod';

const remoteConfig = lazyValue();

fetch('https://your.api.com/config')
  .then((res) => res.json())
  .then(
    (config) => remoteConfig.set(config),
    (error) => {
      // Set a default value if the API call fails that is available as the error is propagated
      remoteConfig.set(null);
      throw error;
    }
  );
```

### Set value before bundling completes

The value must be set before Vite's bundling is expected to complete (and here we say expected because if you don't set the value, Vite will never complete the bundling).

#### Example

In the following code, `pagesData` is set on an Astro hook that runs before Vite's bundling, allowing the pages data to be serialized.

On the other hand, `pagesDataLate` is being set on an Astro hook that runs _after_ Vite's bundling, this is not allowed. Using the `pagesDataLate` value will lead to problems.

```ts ins={"This runs before Vite's bundling, correct": 16-17} del={"This runs after Vite's bundling, incorrect": 20-21}
import { defineIntegration, withPlugins } from 'astro-integration-kit';
import { lazyValue } from '@inox-tools/inline-mod';
import aikMod from '@inox-tools/aik-mod';

export default defineIntegration({
  name: 'my-integration',
  setup: ({ name }) => {
    const pagesData = lazyValue();
    const pagesDataLate = lazyValue();

    return withPlugins({
      name,
      plugins: [aikMod],
      hooks: {
        'astro:build:setup': ({ pages }) => {
.
          pagesData.set(pages);
        },
        'astro:build:done': ({ pages }) => {
.
          pagesDataLate.set(pages);
        },
      },
    });
  },
});
```

### No self dependency

The value must not depend on it's own serialization, neither directly on it's value, or indirectly due to control flow.

#### Example 1: Value is set to it's own serialization

```ts del={"The value is set to the result of serializing itself": 24-25}
import inlineMod from '@inox-tools/inline-mod/vite';
import { lazyValue } from '@inox-tools/inline-mod';

const value = lazyValue();

const moduleId = inlineMod({
  constExports: {
    value,
  },
});

export default () => {
  return [
    inlineMod(),
    {
      name: 'your-plugin',
      resolveId(id) {
        if (id === moduleId) {
          return '\x00' + moduleId;
        }
      },
      async load(id) {
        if (id !== '\x00' + moduleId) return;

        value.set(await this.load({ id }));

        return result;
      },
    },
  ];
};
```

#### Example 2: Value is not set unless serialized

In this case the value doesn't seem to depend on itself, but it does. It is only set after it is serialized, but it can't be serialized until it's set, so even though the value being set is independent of the serialization the action of setting the value is not.

```ts {"Serializes the module, which includes the value": 25-26} del={"But value is only set after the serialization completes, which can't happen": 28-29}
import inlineMod from '@inox-tools/inline-mod/vite';
import { lazyValue } from '@inox-tools/inline-mod';

const value = lazyValue();

const moduleId = inlineMod({
  constExports: {
    value,
  },
});

export default () => {
  return [
    inlineMod(),
    {
      name: 'your-plugin',
      resolveId(id) {
        if (id === moduleId) {
          return '\x00' + moduleId;
        }
      },
      async load(id) {
        if (id !== '\x00' + moduleId) return;

.
        const result = await this.load({ id });

.
        value.set('foo');

        return result;
      },
    },
  ];
};
```
