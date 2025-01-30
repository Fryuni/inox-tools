<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Runtime Logger

Expose Astro Integration Logger at runtime for consistent output

## Install

```sh
npm i @inox-tools/runtime-logger
```

## Using the integration

To enable this, you need to register your integration to have a runtime logger under some name:

```ts
import { runtimeLogger } from '@inox-tools/runtime-logger';

export default () => ({
  name: 'your-integration',
  hooks: {
    'astro:config:setup': (params) => {
      runtimeLogger(params, {
        name: 'your-integration',
      });
    },
  },
});
```

With that in place, your runtime code can now access the logger by importing the generated module `@it-astro:logger:<name>`:

```astro
---
import { logger } from '@it-astro:logger:your-integration';

logger.info('Hello World!');
---
```

## License

Astro Runtime Logger is available under the MIT license.
