import fs from 'node:fs';
import path from 'node:path';

import { LOCAL_SERVER_CACHE_MARKER_FILE_NAME } from '#helpers/constants.ts';
import { getServerCacheDirPath } from '#helpers/start/get-server-cache-dir-path.ts';

import { type TempDir } from '#tests/helpers/temp-dir.ts';

export const createServerCache = (projectDirPath: string) => {
  const cacheDirPath = getServerCacheDirPath(projectDirPath);

  fs.mkdirSync(path.join(cacheDirPath, 'server', 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(cacheDirPath, LOCAL_SERVER_CACHE_MARKER_FILE_NAME), `${JSON.stringify({ projectPath: projectDirPath })}\n`);

  return cacheDirPath;
};

export const createAbandonedServerCache = (tmp: TempDir, projectName: string) => {
  const projectDirPath = tmp.mkdir(`${projectName}/typebase`);
  const cacheDirPath = createServerCache(projectDirPath);

  fs.rmSync(path.dirname(projectDirPath), { recursive: true, force: true });

  return cacheDirPath;
};
