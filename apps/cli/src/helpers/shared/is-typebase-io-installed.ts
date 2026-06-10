import { createRequire } from 'node:module';
import path from 'node:path';

export const isTypebaseIoInstalled = () => {
  const require = createRequire(path.resolve('package.json'));

  try {
    require.resolve('typebase-io/server');
    return true;
  } catch {
    return false;
  }
};
