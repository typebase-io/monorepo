import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const importSchema = async ({ serverDistDirPath }: { serverDistDirPath: string }) => {
  const symlinkPath = path.join(serverDistDirPath, 'node_modules');

  const symlinkExists = await fs.access(symlinkPath).then(
    () => true,
    () => false
  );

  if (!symlinkExists) {
    await fs.symlink(path.resolve('node_modules'), symlinkPath);
  }

  return (await import(pathToFileURL(path.join(serverDistDirPath, 'src', 'db', 'schema.js')).href)) as Record<string, unknown>;
};
