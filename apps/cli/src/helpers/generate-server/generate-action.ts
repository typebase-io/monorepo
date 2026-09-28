import fs from 'node:fs/promises';
import path from 'node:path';

import { type ServerFeatures, serverTemplate } from '#helpers/templates/server.ts';

export const generateAction = async ({ serverOutputDirPath, features }: { serverOutputDirPath: string; features: ServerFeatures }) => {
  await fs.mkdir(serverOutputDirPath, { recursive: true });
  await fs.writeFile(path.join(serverOutputDirPath, 'server.ts'), `${serverTemplate(features)}\n`);
};
