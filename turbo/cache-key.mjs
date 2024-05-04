import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

await writeFile(fileURLToPath(new URL('cache-key.json', import.meta.url)), JSON.stringify(process.versions), 'utf-8');
