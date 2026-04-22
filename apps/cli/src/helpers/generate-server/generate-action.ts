import fs from 'node:fs/promises';
import path from 'node:path';

import { serverTemplate } from '#helpers/templates/server.ts';

export const generateAction = async ({ serverOutputDirPath, hasDB, hasAuth }: { serverOutputDirPath: string; hasDB: boolean; hasAuth: boolean }) => {
  await fs.mkdir(serverOutputDirPath, { recursive: true });
  await fs.writeFile(path.join(serverOutputDirPath, 'server.ts'), `${serverTemplate(hasDB, hasAuth)}\n`);
};
