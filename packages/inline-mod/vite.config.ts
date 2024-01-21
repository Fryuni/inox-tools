import { defineConfig } from 'vite';
import inlineModPlugin, {inlineMod} from './src/vite.js';

const pluginConstants = {
	name: 'other-plugin',
	virtualModule: 'virtual:magic',
};

function definedOnConfig() {
	console.log('Running on function defined on config');
}

const virtualModName = inlineMod({
	defaultExport: () => {
		console.log(`Running inside the ${pluginConstants.name}`);

		definedOnConfig();
	},
	modName: 'virtual:magic',
});

console.log('Running outside the plugin for: ', virtualModName);

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [inlineModPlugin({})],
});
