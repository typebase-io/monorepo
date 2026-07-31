import fs from 'node:fs/promises';

import { exampleEnvTemplate } from '#helpers/templates/example-env.ts';

export const generateExampleEnv = async (path: string) => {
  await fs.writeFile(path, `${exampleEnvTemplate}\n`);
};
