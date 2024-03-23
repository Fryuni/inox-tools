import { loadConfig, type LunariaConfig } from '@lunariajs/core/config';
import { lunaria, type LocalizationStatus } from '@lunariajs/core';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

async function main() {
  const { userConfig } = await loadConfig('./lunaria.config.json');

  const status = await getStatus(userConfig);

  console.log('localizationStatus', status);
}

async function getStatus(config: LunariaConfig): Promise<LocalizationStatus[]> {
  const statusPath = join(config.outDir, 'status.json');

  const prebuiltContent = await readFile(statusPath, 'utf-8').catch(() => null);

  if (prebuiltContent !== null) {
    return JSON.parse(prebuiltContent);
  }

  const newProcessedStatus = await lunaria(config);

  // Ensure output directory exists
  await mkdir(config.outDir, { recursive: true });
  await writeFile(statusPath, JSON.stringify(newProcessedStatus, null, 2));

  return newProcessedStatus;
}

await main();
