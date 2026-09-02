import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import * as dotenv from 'dotenv';

import { readEnvFile } from '#helpers/shared/read-env-file.ts';

export const seedServerEnv = async ({ serverDistDirPath, keys }: { serverDistDirPath: string; keys: string[] }) => {
  const projectEnv = readEnvFile();
  const envFilePath = path.join(serverDistDirPath, '.env');

  const existing = existsSync(envFilePath) ? await fs.readFile(envFilePath, 'utf8') : '';
  const alreadySet = dotenv.parse(existing);

  const added = keys.flatMap((key) => {
    if (alreadySet[key] !== undefined) {
      return [];
    }

    const value = key === 'DATABASE_URL' ? (projectEnv.DATABASE_URL_DEV ?? projectEnv.DATABASE_URL) : projectEnv[key];

    return value === undefined ? [] : [{ key, value }];
  });

  if (added.length === 0) {
    return [];
  }

  const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
  const lines = added.map(({ key, value }) => `${key}=${value}`).join('\n');

  await fs.mkdir(serverDistDirPath, { recursive: true });
  await fs.writeFile(envFilePath, `${existing}${separator}${lines}\n`, 'utf8');

  return added.map(({ key }) => key);
};
