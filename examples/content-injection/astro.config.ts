import { defineConfig } from 'astro/config';
import integration from './integration';
import runtimeLogger from '@inox-tools/runtime-logger';

// https://astro.build/config
export default defineConfig({
	integrations: [runtimeLogger(), integration()],
});
