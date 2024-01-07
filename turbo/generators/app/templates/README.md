# <%= githubRepoName %>

<%= description %>

## Install

```js
npm i -D <%= githubRepoName %>
```

Add plugin to your vite.config.ts:

```js
// vite.config.ts
import { defineConfig } from 'vite'
import <%= pluginName %> from './src/index';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [<%= pluginName %>({})]
})
```
