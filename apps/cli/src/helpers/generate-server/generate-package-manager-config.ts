import fs from 'node:fs/promises';
import path from 'node:path';

import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

export const generatePackageManagerConfig = async ({ outputDirPath }: { outputDirPath: string }): Promise<string | undefined> => {
  const packageManager = await getPackageManager();

  if (packageManager === 'yarn-berry') {
    const content = 'enableScripts: true\n';
    await fs.writeFile(path.join(outputDirPath, '.yarnrc.yml'), content);

    return '.yarnrc.yml';
  }

  if (packageManager === 'bun') {
    const content = '[install]\ntrustedDependencies = ["esbuild"]\n';
    await fs.writeFile(path.join(outputDirPath, 'bunfig.toml'), content);

    return 'bunfig.toml';
  }

  return undefined;
};
