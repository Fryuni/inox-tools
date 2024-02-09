import inlineModPlugin, { defineModule } from '@inox-tools/inline-mod/vite';
import { defineConfig } from 'vite';

defineModule('virtual:interceptors', {
	constExports: {
		interceptCounter: (count) => count % 13,
	},
});

export default defineConfig({
	plugins: [inlineModPlugin({})],
});
