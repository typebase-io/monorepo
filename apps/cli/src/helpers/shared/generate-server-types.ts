import fs from 'node:fs/promises';
import path from 'node:path';

import { getServerRouter } from '#helpers/shared/get-server-router.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { hasEnv } from '#helpers/shared/has-env.ts';
import { serverTypesTemplate } from '#helpers/templates/server-types.ts';

export const generateServerTypes = async ({
  tsConfigFilePath,
  schemaFilePath,
  authFilePath,
  envFilePath,
  actionsDirPath,
  generatedDirPath,
}: {
  tsConfigFilePath: string;
  schemaFilePath: string;
  authFilePath: string;
  envFilePath: string;
  actionsDirPath: string;
  generatedDirPath: string;
}) => {
  const serverTypesOutputPath = path.join(generatedDirPath, 'server.ts');
  const includeDB = hasDB(schemaFilePath);
  const includeAuth = includeDB ? hasAuth(authFilePath) : false;
  const includeEnv = hasEnv(envFilePath);

  const skeleton = serverTypesTemplate(includeDB, includeAuth, includeEnv, '', 'export const router = {\n};');

  await fs.mkdir(path.dirname(serverTypesOutputPath), { recursive: true });
  await fs.writeFile(serverTypesOutputPath, skeleton);

  const [imports, router] = await getServerRouter({
    tsConfigFilePath,
    actionsDirPath,
    outputFilePath: serverTypesOutputPath,
    actionsOutputDirPath: actionsDirPath,
    generation: 'ts',
    exportable: true,
  });

  await fs.writeFile(serverTypesOutputPath, serverTypesTemplate(includeDB, includeAuth, includeEnv, imports, router));
};
