import os from 'node:os';
import path from 'node:path';

export const getServerCacheRootDirPath = (): string => {
  const cacheHome = process.env.XDG_CACHE_HOME;
  const cacheHomeDirPath = cacheHome && cacheHome.length > 0 ? cacheHome : path.join(os.homedir(), '.cache');

  return path.join(cacheHomeDirPath, 'typebase');
};
