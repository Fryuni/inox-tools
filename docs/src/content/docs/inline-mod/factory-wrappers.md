---
title: Factory wrappers
sidebar:
  order: 1
---

When you know how to contruct a value in runtime it may be better to encode that than to serialize all the object state. This greatly reduces the amount of code that has to be generated and enables serialization of values that would not be possible otherwise.

For example, an API client may hold references to open sockets, attempting to serialize such a value will result in an error:

```ts
import { Storage } from '@google-cloud/storage';

const client = new Storage(); // Google Cloud Storage uses GRPC streams, holding an open socket.

// This serialization will fail.
inlineModule({
  defaultExport: client,
});
```

To solve this problem, wrap the construction of the value with a factory like so:

```ts
import { factory } from '@inox-tools/inline-mod';
import { Storage } from '@google-cloud/storage';

const client = factory(() => new Storage());

inlineModule({
  defaultExport: client,
});
```

Now, instead of attempting to serialize the client, the factory will be serialized the result of calling it will be exported:

```js
import { Storage } from '@google-cloud/storage';

const __f0 = () => new Storage();

const __defaultValue = __f0();

export default __defaultValue;
```

### `factory`

Define a factory for a value that should be constructed at runtime.

The value constructed by the factory is also available at build time like before, but it is only constructed once you try to use it:

```ts
import { factory } from '@inox-tools/inline-mod';
import { Storage } from '@google-cloud/storage';

const client = factory(() => new Storage());

inlineModule({
  // Factory is serialized so the client can be created at runtime
  defaultExport: client,
});

// Here the client is instantiated during build.
client.bucket();
```

This means that if the value is not used during build it will only be constructed at runtime.

### `asyncFactory`

Similar to [`factory`](#factory), this functions allows declaring how to construct a value at runtime. The key difference is that using `asyncFactory` the return value of the given factory function will be awaited.

This is useful when you want to load remote information upon initialization of your module, like loading credentials from a remote secret manager.

```ts
import { asyncFactory } from '@inox-tools/inline-mod';

const configFactory = asyncFactory(async () => {
  const res = await fetch('https://config.store/myConfig');
  return res.json();
});

inlineModule({
  defaultExport: configFactory,
});
```

Will generate the following module:

```js
const __f0 = async () => {
  const res = await fetch('https://config.store/myConfig');
  return res.json();
};

const __defaultValue = await __f0();

export default __defaultValue;
```

:::tip
Even though it is an async factory, you don't need to await when importing:

```ts
import configValue from 'virtual:module';

// The config value is already resolved, no need to await it.
configValue.credentials;
```

This is because in ECMAScript modules all `import` statements are implicitly awaited, and the awaiting of the value happens at that time.
:::

Just like `factory`, the value can be used at runtime, but you need to pass the unawaited value to the module definition:

```ts
import { asyncFactory } from '@inox-tools/inline-mod';

const configFactory = asyncfactory(async () => {
  const res = await fetch('https://config.store/myConfig');
  return res.json();
});

// You can await the factory to get the value during config time
const config = await configFactory;

inlineModule({
  // But you need to passs the factory, not the awaited value, to the module definition
  defaultExport: configFactory,
});
```
