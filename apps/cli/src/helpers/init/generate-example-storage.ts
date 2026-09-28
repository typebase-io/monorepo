import fs from 'node:fs/promises';

import { exampleStorageTemplate } from '#helpers/templates/example-storage.ts';

export const generateExampleStorage = async (path: string) => {
  await fs.writeFile(path, `${exampleStorageTemplate}\n`);
};
