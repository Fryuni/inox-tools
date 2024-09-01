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

export async function* streamAsyncIterator(stream: ReadableStream) {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
