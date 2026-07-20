import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { TYPEBASE_CONFIG_FILE_NAME, TYPEBASE_CONFIG_SCHEMA_URL, type TypebaseConfigSchema } from '#helpers/constants.ts';

export const writeTypebaseConfig = async (updates: TypebaseConfigSchema) => {
  const typebaseConfigPath = path.resolve(TYPEBASE_CONFIG_FILE_NAME);

  let existing: Record<string, unknown> = {};

  if (existsSync(typebaseConfigPath)) {
    const content = await fs.readFile(typebaseConfigPath, 'utf8');

    existing = JSON.parse(content) as Record<string, unknown>;
  }

  const merged: Record<string, unknown> = { $schema: TYPEBASE_CONFIG_SCHEMA_URL, ...existing, ...updates };

  merged.$schema = TYPEBASE_CONFIG_SCHEMA_URL;

  await fs.writeFile(typebaseConfigPath, `${JSON.stringify(merged, null, 2)}\n`);
};
