import { defineConfig } from 'vite';
import inlineModPlugin, {inlineMod} from "@inox-tools/inline-mod/vite";

inlineMod({
    constExports: {
        interceptCounter: count => count % 13,
    },
    modName: 'virtual:interceptors',
})

export default defineConfig({
    plugins: [inlineModPlugin({})]
})
