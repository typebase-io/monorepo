import fs from 'node:fs/promises';
import path from 'node:path';

import { getServerRouter } from '#helpers/shared/get-server-router.ts';
import { resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';
import { serverTypesTemplate } from '#helpers/templates/server-types.ts';

export const generateServerTypes = async ({
  tsConfigFilePath,
  schemaFilePath,
  authFilePath,
  envFilePath,
  publisherFilePath,
  storageFilePath,
  actionsDirPath,
  generatedDirPath,
}: {
  tsConfigFilePath: string;
  schemaFilePath: string;
  authFilePath: string;
  envFilePath: string;
  publisherFilePath: string;
  storageFilePath: string;
  actionsDirPath: string;
  generatedDirPath: string;
}) => {
  const serverTypesOutputPath = path.join(generatedDirPath, 'server.ts');

  const {
    hasDB: includeDB,
    hasAuth: includeAuth,
    hasEnv: includeEnv,
    hasPublisher: includePublisher,
    hasStorage: includeStorage,
  } = resolveProjectShapeOrThrow({ schemaFilePath, authFilePath, envFilePath, publisherFilePath, storageFilePath });

  const features = { db: includeDB, auth: includeAuth, env: includeEnv, publisher: includePublisher !== false, storage: includeStorage !== false };
  const skeleton = serverTypesTemplate(features, '', 'export const router = {\n};');

  await fs.mkdir(path.dirname(serverTypesOutputPath), { recursive: true });
  await fs.writeFile(serverTypesOutputPath, skeleton);

  const [imports, router] = await getServerRouter({
    tsConfigFilePath,
    actionsDirPath,
    outputFilePath: serverTypesOutputPath,
    actionsOutputDirPath: actionsDirPath,
    generation: 'ts',
  });

  await fs.writeFile(serverTypesOutputPath, serverTypesTemplate(features, imports, router));
};
