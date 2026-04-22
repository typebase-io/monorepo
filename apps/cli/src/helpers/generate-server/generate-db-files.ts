import fs from 'node:fs/promises';
import path from 'node:path';

import { type ServerAdapter } from '#helpers/constants.ts';
import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';
import { drizzleConfigTemplate } from '#helpers/templates/drizzle-config.ts';
import { drizzleIndexTemplate } from '#helpers/templates/drizzle-index.ts';

export const generateDBFiles = async ({
  dbDirPath,
  dbOutputDirPath,
  useTs,
  adapter,
}: {
  dbDirPath: string;
  dbOutputDirPath: string;
  useTs: boolean;
  adapter: ServerAdapter;
}) => {
  await fs.cp(dbDirPath, dbOutputDirPath, { recursive: true });
  await fs.writeFile(path.join(dbOutputDirPath, 'index.ts'), `${drizzleIndexTemplate(adapter)}\n`);
  await fs.writeFile(path.join(dbOutputDirPath, 'drizzle.config.ts'), `${drizzleConfigTemplate({ ts: useTs, adapter })}\n`);

  await fixImportExtensions(dbOutputDirPath, useTs ? 'ts' : 'js');
};
