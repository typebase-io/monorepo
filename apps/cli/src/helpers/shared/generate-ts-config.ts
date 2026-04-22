import fs from 'node:fs/promises';

import { tsConfigTemplate } from '#helpers/templates/ts-config.ts';

export const generateTsConfig = async ({ path, addWarning }: { path: string; addWarning: boolean }) => {
  await fs.writeFile(path, `${tsConfigTemplate(addWarning)}\n`);
};
