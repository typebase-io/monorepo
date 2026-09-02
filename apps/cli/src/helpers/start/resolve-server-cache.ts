import fs from 'node:fs/promises';
import path from 'node:path';

import { LOCAL_SERVER_CACHE_MARKER_FILE_NAME } from '#helpers/constants.ts';
import { canReplaceServerDir } from '#helpers/generate-server/can-replace-server-dir.ts';
import { getServerCacheDirPath } from '#helpers/start/get-server-cache-dir-path.ts';

export const resolveServerCache = async (typebaseDirPath: string): Promise<{ cacheDirPath: string; serverDirPath: string }> => {
  const cacheDirPath = getServerCacheDirPath(typebaseDirPath);
  const serverDirPath = path.join(cacheDirPath, 'server');

  if (!(await canReplaceServerDir(serverDirPath))) {
    await fs.rm(serverDirPath, { recursive: true, force: true });
  }

  await fs.mkdir(serverDirPath, { recursive: true });

  await fs.writeFile(
    path.join(cacheDirPath, LOCAL_SERVER_CACHE_MARKER_FILE_NAME),
    `${JSON.stringify({ projectPath: path.resolve(typebaseDirPath) }, null, 2)}\n`
  );

  return { cacheDirPath, serverDirPath };
};
