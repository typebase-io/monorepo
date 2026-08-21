import fs from 'node:fs/promises';

import { exampleRelationsTemplate } from '#helpers/templates/example-relations.ts';

export const generateExampleRelations = async ({ path, withAuth, withPublisher }: { path: string; withAuth: boolean; withPublisher: boolean }) => {
  await fs.writeFile(path, `${exampleRelationsTemplate(withAuth, withPublisher)}\n`);
};
