import fs from 'node:fs/promises';

import { exampleRelationsTemplate } from '#helpers/templates/example-relations.ts';

export const generateExampleRelations = async ({ path, withAuth }: { path: string; withAuth: boolean }) => {
  await fs.writeFile(path, `${exampleRelationsTemplate(withAuth)}\n`);
};
