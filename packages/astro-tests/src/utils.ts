import { slash } from '@astrojs/internal-helpers/path';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';

/**
 * Convert file URL to ID for viteServer.moduleGraph.idToModuleMap.get(:viteID)
 * Format:
 *   Linux/Mac:  /Users/astro/code/my-project/src/pages/index.astro
 *   Windows:    C:/Users/astro/code/my-project/src/pages/index.astro
 */
export function viteID(filePath: URL): string {
	return slash(fileURLToPath(filePath) + filePath.search);
}

export const isLinux = os.platform() === 'linux';
export const isMacOS = os.platform() === 'darwin';
export const isWindows = os.platform() === 'win32';

export function fixLineEndings(str: string) {
	return str.replace(/\r\n/g, '\n');
}

/**
 * Like the lib `callsites` but with the proper Node types
 * instead of old compatibility types.
 */
export function callsites(): NodeJS.CallSite[] {
	const oldPrepare = Error.prepareStackTrace;
	try {
		Error.prepareStackTrace = (_, stackTrace) => stackTrace;
		// TS expects it be a string, but now it is the internal objects.
		const stack = new Error('nothing').stack as unknown as NodeJS.CallSite[];

		// Remove the frame of `callsites` itself.
		return stack.slice(1);
	} finally {
		Error.prepareStackTrace = oldPrepare;
	}
}
