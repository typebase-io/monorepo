import { describe, expect, it, vi } from 'vitest';

import { getPackageManagerInstallCommand } from '#helpers/shared/get-package-manager-install-command.ts';
import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

vi.mock('#helpers/shared/get-package-manager.ts', () => ({
  getPackageManager: vi.fn(),
}));

describe('getPackageManagerInstallCommand', () => {
  it('returns the right command for each known package manager', async () => {
    expect(await getPackageManagerInstallCommand('npm')).toBe('npm install --force');
    expect(await getPackageManagerInstallCommand('pnpm')).toBe('pnpm install --no-strict-peer-dependencies');
    expect(await getPackageManagerInstallCommand('yarn-classic')).toBe('yarn install');
    expect(await getPackageManagerInstallCommand('yarn-berry')).toBe('yarn install');
    expect(await getPackageManagerInstallCommand('bun')).toBe('bun install');
  });

  it('falls back to a forced npm install for an unknown package manager', async () => {
    expect(await getPackageManagerInstallCommand('unknown')).toBe('npm install --force');
  });

  it('detects the package manager when no custom one is passed', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('pnpm');

    expect(await getPackageManagerInstallCommand()).toBe('pnpm install --no-strict-peer-dependencies');
  });
});
