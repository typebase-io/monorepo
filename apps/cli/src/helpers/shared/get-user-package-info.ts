import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export const getUserPackageInfo = async (startDir = process.cwd()) => {
  let currentDir = startDir;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const packageJsonPath = join(currentDir, 'package.json');

    try {
      const content = await readFile(packageJsonPath, 'utf8');

      return { packageJson: JSON.parse(content) as PackageJson, dirPath: currentDir };
    } catch {
      const parentDir = dirname(currentDir);

      if (parentDir === currentDir) {
        throw new Error('No package.json found in this or any parent directory');
      }

      currentDir = parentDir;
    }
  }
};
