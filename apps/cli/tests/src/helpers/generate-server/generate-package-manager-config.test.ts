import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generatePackageManagerConfig } from '#helpers/generate-server/generate-package-manager-config.ts';
import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/shared/get-package-manager.ts', () => ({ getPackageManager: vi.fn() }));

const configFiles = ['.yarnrc.yml', 'bunfig.toml', 'pnpm-workspace.yaml'] as const;

describe('generatePackageManagerConfig', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  const expectOnlyFile = (fileName: (typeof configFiles)[number]) => {
    for (const other of configFiles.filter((file) => file !== fileName)) {
      expect(tmp.exists(other)).toBe(false);
    }
  };

  it('writes a .yarnrc.yml for yarn-berry', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('yarn-berry');

    const result = await generatePackageManagerConfig({ outputDirPath: tmp.path });

    expect(result).toBe('.yarnrc.yml');
    expect(tmp.read('.yarnrc.yml')).toEqualTemplate('generate-package-manager-config', 'yarnrc.yml.txt');
    expectOnlyFile('.yarnrc.yml');
  });

  it('writes a bunfig.toml for bun', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('bun');

    const result = await generatePackageManagerConfig({ outputDirPath: tmp.path });

    expect(result).toBe('bunfig.toml');
    expect(tmp.read('bunfig.toml')).toEqualTemplate('generate-package-manager-config', 'bunfig.toml.txt');
    expectOnlyFile('bunfig.toml');
  });

  it('writes a pnpm-workspace.yaml for pnpm', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('pnpm');

    const result = await generatePackageManagerConfig({ outputDirPath: tmp.path });

    expect(result).toBe('pnpm-workspace.yaml');
    expect(tmp.read('pnpm-workspace.yaml')).toEqualTemplate('generate-package-manager-config', 'pnpm-workspace.yaml.txt');
    expectOnlyFile('pnpm-workspace.yaml');
  });

  it.each(['npm', 'yarn-classic', 'unknown'] as const)('writes nothing and returns undefined for %s', async (packageManager) => {
    vi.mocked(getPackageManager).mockResolvedValue(packageManager);

    const result = await generatePackageManagerConfig({ outputDirPath: tmp.path });

    expect(result).toBeUndefined();

    for (const file of configFiles) {
      expect(tmp.exists(file)).toBe(false);
    }
  });
});
