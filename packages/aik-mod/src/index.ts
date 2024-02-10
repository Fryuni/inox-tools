import { definePlugin } from 'astro-integration-kit';
import vitePlugin, { defineModule, inlineModule, type ModuleOptions } from '@inox-tools/inline-mod/vite';
import type { PluginOption } from 'vite';
import type { HookParameters } from 'astro';

process.setSourceMapsEnabled(true);

function hasPlugin(pluginList: PluginOption[], pluginName: string): boolean {
  return pluginList.some((plugin) => {
    if (!plugin) return false;

    if (Array.isArray(plugin)) {
      return hasPlugin(plugin, pluginName);
    }

    if (plugin instanceof Promise) {
      // Ignore async plugin construction
      return false;
    }

    return plugin.name === pluginName;
  });
};

function ensurePluginIsInstalled(
  options: Pick<HookParameters<'astro:config:setup'>, 'config' | 'updateConfig'>
): () => void {
  const { config, updateConfig } = options;
  if (hasPlugin(config.vite?.plugins || [], '@inox-tools/inline-mod')) {
    return () => { };
  }

  let done = false;

  return () => {
    if (done) return;
    done = true;
    updateConfig({
      vite: {
        plugins: [vitePlugin()],
      },
    });
  };

}

export const inlineModPlugin = definePlugin({
  name: 'inlineModule',
  hook: 'astro:config:setup',
  implementation: ({ config, updateConfig }) => {
    const ensurePlugin = ensurePluginIsInstalled({ config, updateConfig });
    return (options: ModuleOptions) => {
      ensurePlugin();
      return inlineModule(options);
    };
  }
});

export const defineModPlugin = definePlugin({
  name: 'defineModule',
  hook: 'astro:config:setup',
  implementation: ({ config, updateConfig }) => {
    const ensurePlugin = ensurePluginIsInstalled({ config, updateConfig });
    return (name: string, options: ModuleOptions) => {
      ensurePlugin();
      return defineModule(name, options);
    };
  }
});
