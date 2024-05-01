import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await writeFile(join(import.meta.dirname, 'cache-key.json'), JSON.stringify(process.versions), 'utf-8');
