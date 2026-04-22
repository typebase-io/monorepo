import fs from 'node:fs/promises';

import { exampleSchemaTemplate } from '#helpers/templates/example-schema.ts';

export const generateExampleSchema = async ({ path, withAuth }: { path: string; withAuth: boolean }) => {
  await fs.writeFile(path, `${exampleSchemaTemplate(withAuth)}\n`);
};
