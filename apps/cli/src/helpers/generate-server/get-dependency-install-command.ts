import { match } from 'ts-pattern';

import { type PackageManager } from '#helpers/shared/get-package-manager.ts';

export const getDependencyInstallCommand = ({
  packageManager,
  dependencies,
  development,
}: {
  packageManager: PackageManager;
  dependencies: Record<string, string>;
  development: boolean;
}) => {
  const packages = Object.entries(dependencies).map(([name, version]) => `'${`${name}@${version}`.replaceAll("'", "'\\''")}'`);

  if (packages.length === 0) {
    return undefined;
  }

  const command = match(packageManager)
    .with('yarn-berry', 'yarn-classic', () => 'yarn add')
    .with('bun', () => 'bun add')
    .with('pnpm', () => 'pnpm add')
    .with('npm', 'unknown', () => 'npm install')
    .exhaustive();

  return `${command}${development ? ' -D' : ''} ${packages.join(' ')}`;
};
