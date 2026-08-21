import fs from 'node:fs/promises';

import { exampleSchemaTemplate } from '#helpers/templates/example-schema.ts';

export const generateExampleSchema = async ({ path, withAuth, withPublisher }: { path: string; withAuth: boolean; withPublisher: boolean }) => {
  await fs.writeFile(path, `${exampleSchemaTemplate(withAuth, withPublisher)}\n`);
};
