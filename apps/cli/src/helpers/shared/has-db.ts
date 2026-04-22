import { existsSync } from 'node:fs';
import path from 'node:path';

export const hasDB = (schemaFilePath: string) => {
  return existsSync(path.resolve(schemaFilePath));
};
