import { defineConfig } from 'vite';
import inlineMod from './src/index.js';
import inlineModPlugin from './src/vite.js';

const pluginConstants = {
	name: 'other-plugin',
	virtualModule: 'virtual:magic',
};

function definedOnConfig() {
	console.log('Running on function defined on config');
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		{
			name: pluginConstants.name,
			resolveId: (name) => {
				if (name === 'virtual:magic') {
					return inlineMod({
						default: () => {
							console.log(`Running inside the ${pluginConstants.name}`);

							definedOnConfig();
						},
					});
				}
			},
		},
		inlineModPlugin({}),
	],
});
