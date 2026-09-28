import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ensureLocalStorageRoot = (root: string) => {
  mkdirSync(root, { recursive: true });

  try {
    writeFileSync(path.join(root, '.gitignore'), '*\n', { flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw err;
    }
  }
};
