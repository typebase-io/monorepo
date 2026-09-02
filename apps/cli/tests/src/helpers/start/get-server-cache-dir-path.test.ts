import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getServerCacheDirPath } from '#helpers/start/get-server-cache-dir-path.ts';
import { getServerCacheRootDirPath } from '#helpers/start/get-server-cache-root-dir-path.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getServerCacheDirPath', () => {
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

  it('puts the cache directly under the root every cache shares', () => {
    const cacheDirPath = getServerCacheDirPath(tmp.mkdir('project/typebase'));

    expect(path.dirname(cacheDirPath)).toBe(getServerCacheRootDirPath());
  });

  it('follows the root when the XDG cache directory changes', () => {
    const projectDirPath = tmp.mkdir('project/typebase');

    process.env.XDG_CACHE_HOME = tmp.mkdir('somewhere-else');

    expect(getServerCacheDirPath(projectDirPath).startsWith(path.join(tmp.path, 'somewhere-else', 'typebase'))).toBe(true);
  });

  it('never puts the cache inside the project', () => {
    const projectDirPath = tmp.mkdir('project/typebase');

    expect(getServerCacheDirPath(projectDirPath).startsWith(path.join(tmp.path, 'project'))).toBe(false);
  });

  it('resolves one project to the same directory every time', () => {
    const projectDirPath = tmp.mkdir('project/typebase');

    expect(getServerCacheDirPath(projectDirPath)).toBe(getServerCacheDirPath(projectDirPath));
  });

  it('resolves the same directory whether the project path is absolute or relative to it', () => {
    const projectDirPath = tmp.mkdir('project/typebase');

    expect(getServerCacheDirPath(path.join(projectDirPath, '..', 'typebase'))).toBe(getServerCacheDirPath(projectDirPath));
  });

  it('names the directory after the project it belongs to', () => {
    expect(path.basename(getServerCacheDirPath(tmp.mkdir('my-app/typebase')))).toMatch(/^my-app-[a-f0-9]{12}$/);
  });

  it.each([
    { name: 'two projects with different names', a: 'one/typebase', b: 'two/typebase' },
    { name: 'two typebase directories in one project', a: 'project/typebase', b: 'project/src/typebase' },
    { name: 'two projects with the same name in different places', a: 'a/app/typebase', b: 'b/app/typebase' },
  ])('never shares a directory between $name', ({ a, b }) => {
    expect(getServerCacheDirPath(tmp.mkdir(a))).not.toBe(getServerCacheDirPath(tmp.mkdir(b)));
  });
});
