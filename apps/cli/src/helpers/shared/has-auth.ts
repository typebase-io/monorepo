import { existsSync } from 'node:fs';
import path from 'node:path';

export const hasAuth = (authFilePath: string) => {
  return existsSync(path.resolve(authFilePath));
};
