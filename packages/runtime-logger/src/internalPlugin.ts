import type { Plugin } from 'vite';
import { readFile } from 'fs/promises';

export const INTERNAL_MODULE = '@it-astro:logger-internal';
const RESOLVED_INTERNAL_MODULE = '\x00@it-astro:logger-internal';

const templatePath = new URL('../template/loggerStub.mjs', import.meta.url);

export const loggerInternalsPlugin: Plugin = {
	name: '@inox-tools/runtime-logger/internal',
	resolveId(id) {
		if (id === INTERNAL_MODULE) {
			return RESOLVED_INTERNAL_MODULE;
		}
	},
	load(id) {
		if (id !== RESOLVED_INTERNAL_MODULE) return;

		return readFile(templatePath, 'utf-8');
	},
};
