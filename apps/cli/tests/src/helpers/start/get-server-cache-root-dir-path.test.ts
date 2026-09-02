import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getServerCacheRootDirPath } from '#helpers/start/get-server-cache-root-dir-path.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getServerCacheRootDirPath', () => {
  let tmp: TempDir;
  let originalCacheHome: string | undefined;

  beforeEach(() => {
    tmp = createTempDir();
    originalCacheHome = process.env.XDG_CACHE_HOME;

    process.env.XDG_CACHE_HOME = tmp.mkdir('cache');
  });

  afterEach(() => {
    if (originalCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalCacheHome;
    }

    tmp.cleanup();
  });

  it('puts every cache under the XDG cache directory when one is set', () => {
    expect(getServerCacheRootDirPath()).toBe(path.join(tmp.path, 'cache', 'typebase'));
  });

  it.each([
    { name: 'unset', value: undefined },
    { name: 'empty', value: '' },
  ])('falls back to the home cache directory when the XDG cache directory is $name', ({ value }) => {
    if (value === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = value;
    }

    expect(getServerCacheRootDirPath()).toBe(path.join(os.homedir(), '.cache', 'typebase'));
  });

  it('resolves the same root every time', () => {
    expect(getServerCacheRootDirPath()).toBe(getServerCacheRootDirPath());
  });
});
