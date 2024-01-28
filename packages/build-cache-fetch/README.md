<p align="center">
    <img alt="InoxTools" width="350px" src="https://github.com/Fryuni/inox-tools/blob/main/assets/shield.png?raw=true"/>
</p>

# Build Cache Fetch

Cache fetches during build time for client and ssr

```ts
// astro.config.mjs
import { buildCacheFetch } from '@inox-tools/build-cache-fetch';

export default defineConfig({
  integrations: [
    buildCacheFetch({ }),
  ],
});
```

### License

Build Cache Fetch is available under the MIT license.

