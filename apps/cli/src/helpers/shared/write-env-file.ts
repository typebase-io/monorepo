import fs from 'node:fs/promises';
import path from 'node:path';

import { readEnvFile } from '#helpers/shared/read-env-file.ts';

export const writeEnvFile = async (name: string, value: string) => {
  const envPath = path.resolve('.env');
  const env = readEnvFile();

  const lines = Object.entries({ ...env, [name]: value }).map(([key, value]) => `${key}=${value}`);

  await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf8');
};
