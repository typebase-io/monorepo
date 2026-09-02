import { createHash } from 'node:crypto';
import path from 'node:path';

import { canonicalizePath } from '#helpers/shared/canonicalize-path.ts';
import { getServerCacheRootDirPath } from '#helpers/start/get-server-cache-root-dir-path.ts';

export const getServerCacheDirPath = (typebaseDirPath: string): string => {
  const canonicalPath = canonicalizePath(path.resolve(typebaseDirPath));
  const fingerprint = createHash('sha256').update(canonicalPath).digest('hex').slice(0, 12);
  const projectName = path.basename(path.dirname(canonicalPath)).replace(/[^a-zA-Z0-9-_]/g, '-');

  return path.join(getServerCacheRootDirPath(), `${projectName}-${fingerprint}`);
};
