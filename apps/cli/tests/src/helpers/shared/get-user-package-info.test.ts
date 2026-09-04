import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getUserPackageInfo } from '#helpers/shared/get-user-package-info.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('getUserPackageInfo', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns the manifest and its containing directory', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: '^8' } }));

    expect(await getUserPackageInfo(tmp.path)).toEqual({ packageJson: { dependencies: { pg: '^8' } }, dirPath: tmp.path });
  });

  it('finds the closest manifest above a nested output directory', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: '^7' } }));
    tmp.write('host/package.json', JSON.stringify({ dependencies: { pg: '^8' } }));

    expect(await getUserPackageInfo(path.join(tmp.path, 'host/src/generated'))).toEqual({
      packageJson: { dependencies: { pg: '^8' } },
      dirPath: path.join(tmp.path, 'host'),
    });
  });

  it('preserves the fallback past a malformed manifest', async () => {
    tmp.write('package.json', '{}');
    tmp.write('host/package.json', '{ invalid json');

    expect(await getUserPackageInfo(path.join(tmp.path, 'host'))).toEqual({ packageJson: {}, dirPath: tmp.path });
  });

  it('defaults to the current working directory', async () => {
    tmp.write('package.json', '{}');

    expect(await withCwd(tmp.path, () => getUserPackageInfo())).toEqual({ packageJson: {}, dirPath: tmp.path });
  });

  it('throws when no manifest can be found', async () => {
    await expect(getUserPackageInfo(tmp.path)).rejects.toThrow('No package.json found in this or any parent directory');
  });
});
