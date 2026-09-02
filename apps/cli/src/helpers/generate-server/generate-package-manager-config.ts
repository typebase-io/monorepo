import fs from 'node:fs/promises';
import path from 'node:path';

import { match } from 'ts-pattern';

import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

export const generatePackageManagerConfig = async ({ outputDirPath }: { outputDirPath: string }): Promise<string | undefined> => {
  const packageManager = await getPackageManager();

  const config = match(packageManager)
    .with('yarn-berry', () => ({ fileName: '.yarnrc.yml', content: 'enableScripts: true\n' }))
    .with('bun', () => ({ fileName: 'bunfig.toml', content: '[install]\ntrustedDependencies = ["esbuild"]\n' }))
    .with('pnpm', () => ({ fileName: 'pnpm-workspace.yaml', content: 'packages: []\n\nallowBuilds:\n  esbuild: true\n' }))
    .with('npm', 'yarn-classic', 'unknown', () => undefined)
    .exhaustive();

  if (!config) {
    return undefined;
  }

  await fs.writeFile(path.join(outputDirPath, config.fileName), config.content);

  return config.fileName;
};
