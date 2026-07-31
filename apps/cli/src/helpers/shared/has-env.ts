import { existsSync } from 'node:fs';
import path from 'node:path';

export const hasEnv = (envFilePath: string) => {
  return existsSync(path.resolve(envFilePath));
};
