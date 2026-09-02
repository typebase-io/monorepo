import { createHash } from 'node:crypto';
import path from 'node:path';

import { hashFile } from '#helpers/shared/hash-file.ts';
import { walk } from '#helpers/shared/walk.ts';

export const hashDirectory = async (dirPath: string): Promise<string> => {
  const filePaths = (await walk(dirPath)).sort();

  if (filePaths.length === 0) {
    return '';
  }

  const hash = createHash('sha256');

  for (const filePath of filePaths) {
    hash.update(`${path.relative(dirPath, filePath)}:${await hashFile(filePath)}\n`);
  }

  return hash.digest('hex');
};
