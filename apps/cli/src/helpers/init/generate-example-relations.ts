import fs from 'node:fs/promises';

import { exampleRelationsTemplate } from '#helpers/templates/example-relations.ts';

export const generateExampleRelations = async (path: string) => {
  await fs.writeFile(path, `${exampleRelationsTemplate}\n`);
};
