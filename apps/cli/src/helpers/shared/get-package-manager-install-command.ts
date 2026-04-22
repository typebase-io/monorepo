import { match } from 'ts-pattern';

import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

export const getPackageManagerInstallCommand = async () => {
  const packageManager = await getPackageManager();

  return match(packageManager)
    .with('npm', () => 'npm install --force')
    .with('pnpm', () => 'pnpm install --no-strict-peer-dependencies')
    .with('yarn-classic', () => 'yarn install')
    .with('yarn-berry', () => 'yarn install')
    .with('bun', () => 'bun install')
    .with('unknown', () => 'npm install --force')
    .exhaustive();
};
