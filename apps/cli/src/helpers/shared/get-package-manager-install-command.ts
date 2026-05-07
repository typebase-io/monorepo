import { match } from 'ts-pattern';

import { type PackageManager, getPackageManager } from '#helpers/shared/get-package-manager.ts';

export const getPackageManagerInstallCommand = async (customPackageManager?: PackageManager) => {
  const packageManager = customPackageManager ?? (await getPackageManager());

  return match(packageManager)
    .with('npm', () => 'npm install --force')
    .with('pnpm', () => 'pnpm install --no-strict-peer-dependencies')
    .with('yarn-classic', () => 'yarn install')
    .with('yarn-berry', () => 'yarn install')
    .with('bun', () => 'bun install')
    .with('unknown', () => 'npm install --force')
    .exhaustive();
};
