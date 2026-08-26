import { readFileSync } from 'node:fs';
import path from 'node:path';

interface PackageJson {
  name?: string;
  version?: string;
}

export const findPackageVersion = ({ fromPath, packageName }: { fromPath: string; packageName: string }) => {
  let currentDir = path.dirname(path.resolve(fromPath));

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    let packageJson: PackageJson | undefined;

    try {
      packageJson = JSON.parse(readFileSync(path.join(currentDir, 'package.json'), 'utf8')) as PackageJson;
    } catch {
      packageJson = undefined;
    }

    if (packageJson?.name !== undefined && packageName === packageJson.name) {
      return packageJson.version;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return undefined;
    }

    currentDir = parentDir;
  }
};
