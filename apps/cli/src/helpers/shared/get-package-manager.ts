import { preferredPM } from 'preferred-pm';

export type PackageManager = 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry' | 'bun' | 'unknown';

export const getPackageManager = async (): Promise<PackageManager> => {
  const usedPackageManager = await preferredPM(process.cwd());

  if (!usedPackageManager) {
    return 'unknown';
  }

  if (usedPackageManager.name === 'yarn') {
    const major = parseInt(usedPackageManager.version.split('.')[0] ?? '', 10);
    return major >= 2 ? 'yarn-berry' : 'yarn-classic';
  }

  return usedPackageManager.name;
};
