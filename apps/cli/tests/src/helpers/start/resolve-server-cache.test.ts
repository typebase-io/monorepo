import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LOCAL_SERVER_CACHE_MARKER_FILE_NAME } from '#helpers/constants.ts';
import { getServerCacheDirPath } from '#helpers/start/get-server-cache-dir-path.ts';
import { resolveServerCache } from '#helpers/start/resolve-server-cache.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('resolveServerCache', () => {
  let tmp: TempDir;
  let originalCacheHome: string | undefined;

  const readMarker = (cacheDirPath: string): unknown =>
    JSON.parse(fs.readFileSync(path.join(cacheDirPath, LOCAL_SERVER_CACHE_MARKER_FILE_NAME), 'utf8'));

  const generatedServer = (serverDirPath: string) => {
    fs.mkdirSync(serverDirPath, { recursive: true });
    fs.writeFileSync(path.join(serverDirPath, 'package.json'), JSON.stringify({ name: '@typebase-io/server' }));
    fs.mkdirSync(path.join(serverDirPath, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(serverDirPath, 'node_modules', 'installed.txt'), 'from the last run');
  };

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

  it('creates the cache and records the project that owns it', async () => {
    const projectDirPath = tmp.mkdir('project/typebase');

    const { cacheDirPath, serverDirPath } = await resolveServerCache(projectDirPath);

    expect(cacheDirPath).toBe(getServerCacheDirPath(projectDirPath));
    expect(serverDirPath).toBe(path.join(cacheDirPath, 'server'));
    expect(fs.existsSync(serverDirPath)).toBe(true);
    expect(readMarker(cacheDirPath)).toEqual({ projectPath: path.resolve(projectDirPath) });
  });

  it('records an absolute project path even when given a relative one', async () => {
    const projectDirPath = tmp.mkdir('project/typebase');
    const originalCwd = process.cwd();

    process.chdir(path.join(projectDirPath, '..'));

    try {
      const { cacheDirPath } = await resolveServerCache('typebase');

      expect(readMarker(cacheDirPath)).toEqual({ projectPath: path.resolve(projectDirPath) });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('keeps the server and the dependencies an earlier run left behind', async () => {
    const projectDirPath = tmp.mkdir('project/typebase');

    generatedServer(path.join(getServerCacheDirPath(projectDirPath), 'server'));

    const { serverDirPath } = await resolveServerCache(projectDirPath);

    expect(fs.existsSync(path.join(serverDirPath, 'node_modules', 'installed.txt'))).toBe(true);
  });

  it('empties a cache that an interrupted run left holding dependencies and no server', async () => {
    const projectDirPath = tmp.mkdir('project/typebase');
    const abandoned = path.join(getServerCacheDirPath(projectDirPath), 'server');

    fs.mkdirSync(path.join(abandoned, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(abandoned, 'node_modules', 'half-installed.txt'), 'from a build that never finished');

    const { serverDirPath } = await resolveServerCache(projectDirPath);

    expect(fs.readdirSync(serverDirPath)).toEqual([]);
  });

  it('empties a cache holding something that is not a generated server at all', async () => {
    const projectDirPath = tmp.mkdir('project/typebase');
    const abandoned = path.join(getServerCacheDirPath(projectDirPath), 'server');

    fs.mkdirSync(abandoned, { recursive: true });
    fs.writeFileSync(path.join(abandoned, 'notes.txt'), 'someone put this here');

    const { serverDirPath } = await resolveServerCache(projectDirPath);

    expect(fs.readdirSync(serverDirPath)).toEqual([]);
  });
});
