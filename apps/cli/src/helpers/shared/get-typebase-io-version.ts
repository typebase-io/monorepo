import { createRequire } from 'node:module';
import path from 'node:path';

import { findPackageVersion } from '#helpers/shared/find-package-version.ts';

export const getTypebaseIoVersion = () => {
  const require = createRequire(path.resolve('package.json'));

  try {
    return findPackageVersion({ fromPath: require.resolve('typebase-io/server'), packageName: 'typebase-io' });
  } catch {
    return undefined;
  }
};
