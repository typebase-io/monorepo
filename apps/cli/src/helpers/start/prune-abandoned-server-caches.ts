import fs from 'node:fs/promises';
import path from 'node:path';

import { LOCAL_SERVER_CACHE_MARKER_FILE_NAME } from '#helpers/constants.ts';
import { getServerCacheRootDirPath } from '#helpers/start/get-server-cache-root-dir-path.ts';

export const pruneAbandonedServerCaches = async (): Promise<void> => {
  const rootDirPath = getServerCacheRootDirPath();

  let entries;

  try {
    entries = await fs.readdir(rootDirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const cacheDirPath = path.join(rootDirPath, entry.name);

    const projectPath = await (async () => {
      let marker: unknown;

      try {
        marker = JSON.parse(await fs.readFile(path.join(cacheDirPath, LOCAL_SERVER_CACHE_MARKER_FILE_NAME), 'utf8'));
      } catch {
        return undefined;
      }

      if (typeof marker !== 'object' || marker === null) {
        return undefined;
      }

      const { projectPath } = marker as { projectPath?: unknown };

      return typeof projectPath === 'string' && path.isAbsolute(projectPath) ? projectPath : undefined;
    })();

    if (projectPath === undefined) {
      continue;
    }

    const isDeleted = await (async () => {
      try {
        await fs.stat(projectPath);
      } catch (err) {
        return (err as NodeJS.ErrnoException).code === 'ENOENT';
      }

      return false;
    })();

    if (!isDeleted) {
      continue;
    }

    try {
      await fs.rm(cacheDirPath, { recursive: true, force: true });
    } catch {
      continue;
    }
  }
};
