import fs from 'node:fs/promises';
import path from 'node:path';

import { serverTemplate } from '#helpers/templates/server.ts';

export const generateAction = async ({
  serverOutputDirPath,
  hasDB,
  hasAuth,
  hasEnv,
}: {
  serverOutputDirPath: string;
  hasDB: boolean;
  hasAuth: boolean;
  hasEnv: boolean;
}) => {
  await fs.mkdir(serverOutputDirPath, { recursive: true });
  await fs.writeFile(path.join(serverOutputDirPath, 'server.ts'), `${serverTemplate(hasDB, hasAuth, hasEnv)}\n`);
};
