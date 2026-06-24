import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generatePackageManagerConfig } from '#helpers/generate-server/generate-package-manager-config.ts';
import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/shared/get-package-manager.ts', () => ({ getPackageManager: vi.fn() }));

describe('generatePackageManagerConfig', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('writes a .yarnrc.yml for yarn-berry', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('yarn-berry');

    const result = await generatePackageManagerConfig({ outputDirPath: tmp.path });

    expect(result).toBe('.yarnrc.yml');
    expect(tmp.read('.yarnrc.yml')).toBe('enableScripts: true\n');
  });

  it('writes a bunfig.toml for bun', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('bun');

    const result = await generatePackageManagerConfig({ outputDirPath: tmp.path });

    expect(result).toBe('bunfig.toml');
    expect(tmp.read('bunfig.toml')).toBe('[install]\ntrustedDependencies = ["esbuild"]\n');
  });

  it('writes nothing and returns undefined for other package managers', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('pnpm');

    const result = await generatePackageManagerConfig({ outputDirPath: tmp.path });

    expect(result).toBeUndefined();
    expect(tmp.exists('.yarnrc.yml')).toBe(false);
    expect(tmp.exists('bunfig.toml')).toBe(false);
  });
});
