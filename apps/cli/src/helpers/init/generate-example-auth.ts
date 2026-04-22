import fs from 'node:fs/promises';

import { exampleAuthTemplate } from '#helpers/templates/example-auth.ts';

export const generateExampleAuth = async (path: string) => {
  await fs.writeFile(path, `${exampleAuthTemplate}\n`);
};
