import fs from 'node:fs/promises';
import path from 'node:path';

import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { dbTypesTemplate } from '#helpers/templates/db-types.ts';

export const generateDBTypes = async ({
  schemaFilePath,
  authFilePath,
  outFilePath,
}: {
  schemaFilePath: string;
  authFilePath: string;
  outFilePath: string;
}) => {
  await fs.rm(outFilePath, { recursive: true, force: true });

  if (!hasDB(schemaFilePath)) {
    return;
  }

  await fs.mkdir(path.dirname(outFilePath), { recursive: true });

  let schemaImportPath = path.relative(path.dirname(outFilePath), schemaFilePath).replaceAll('\\', '/');

  if (!schemaImportPath.startsWith('.')) {
    schemaImportPath = `./${schemaImportPath}`;
  }

  await fs.writeFile(outFilePath, dbTypesTemplate(schemaImportPath, hasAuth(authFilePath)));
};
