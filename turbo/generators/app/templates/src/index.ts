/**
 * Vite Plugin API
 * https://cn.vitejs.dev/guide/api-plugin.html
 */
 import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";

export type Options = {
    // TODO 
}

export default function <%= pluginName %>(options: Options): Plugin {
    let config: ResolvedConfig;

    return {
        name: 'vite-plugin-<%= name %>',
        apply(config, { command }) {
            // TODO
            return command === 'serve';
        },
        config(config: UserConfig, { command }) {
            // TODO
        },
        configResolved(resolvedConfig: ResolvedConfig) {
            // TODO
        },
        configureServer(server: ViteDevServer) {
            // TODO
        }
    }
}
