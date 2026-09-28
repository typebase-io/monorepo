import { existsSync } from 'node:fs';
import path from 'node:path';

export const hasStorage = (storageFilePath: string) => {
  return existsSync(path.resolve(storageFilePath));
};
