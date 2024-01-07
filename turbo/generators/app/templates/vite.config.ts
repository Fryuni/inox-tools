import { defineConfig } from 'vite'
import <%= pluginName %> from './src/index';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [<%= pluginName %>({})]
})