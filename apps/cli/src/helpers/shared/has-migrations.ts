import { existsSync } from 'node:fs';
import path from 'node:path';

export const hasMigrations = (migrationsDirPath: string) => {
  return existsSync(path.resolve(migrationsDirPath));
};
