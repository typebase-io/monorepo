import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LOCAL_SERVER_CACHE_MARKER_FILE_NAME } from '#helpers/constants.ts';
import { pruneAbandonedServerCaches } from '#helpers/start/prune-abandoned-server-caches.ts';

import { createAbandonedServerCache, createServerCache } from '#tests/helpers/server-cache.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('pruneAbandonedServerCaches', () => {
  let tmp: TempDir;
  let originalCacheHome: string | undefined;

  const project = (name: string) => tmp.mkdir(`${name}/typebase`);

  const abandonedCache = (name: string) => createAbandonedServerCache(tmp, name);

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

  it('removes a cache whose project no longer exists', async () => {
    const cacheDirPath = abandonedCache('deleted-app');

    await pruneAbandonedServerCaches();

    expect(fs.existsSync(cacheDirPath)).toBe(false);
  });

  it('leaves a cache whose project still exists alone', async () => {
    const cacheDirPath = createServerCache(project('live-app'));

    await pruneAbandonedServerCaches();

    expect(fs.existsSync(path.join(cacheDirPath, 'server', 'node_modules'))).toBe(true);
  });

  it('leaves a cache alone when it cannot tell whether the project still exists', async () => {
    const projectDirPath = project('unreachable-app');
    const cacheDirPath = createServerCache(projectDirPath);
    const unreadable = path.dirname(projectDirPath);

    fs.chmodSync(unreadable, 0o000);

    try {
      await pruneAbandonedServerCaches();

      expect(fs.existsSync(cacheDirPath)).toBe(true);
    } finally {
      fs.chmodSync(unreadable, 0o755);
    }
  });

  it.each([
    { name: 'carries no marker at all', marker: undefined },
    { name: 'carries a marker that is not JSON', marker: 'not json at all' },
    { name: 'carries a marker that is not an object', marker: JSON.stringify('typebase') },
    { name: 'carries an empty marker', marker: JSON.stringify(null) },
    { name: 'carries a marker with no project path', marker: JSON.stringify({ createdAt: 'yesterday' }) },
    { name: 'carries a marker whose project path is not a path', marker: JSON.stringify({ projectPath: 42 }) },
    { name: 'carries a marker whose project path is relative', marker: JSON.stringify({ projectPath: 'typebase' }) },
  ])('leaves a directory that $name alone', async ({ marker }) => {
    const dirPath = path.join(process.env.XDG_CACHE_HOME ?? '', 'typebase', 'not-ours');

    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, 'notes.txt'), 'someone else put this here');

    if (marker !== undefined) {
      fs.writeFileSync(path.join(dirPath, LOCAL_SERVER_CACHE_MARKER_FILE_NAME), marker);
    }

    await pruneAbandonedServerCaches();

    expect(fs.existsSync(path.join(dirPath, 'notes.txt'))).toBe(true);
  });

  it('leaves a file sitting next to the caches alone', async () => {
    const filePath = path.join(process.env.XDG_CACHE_HOME ?? '', 'typebase', 'stray.txt');

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'someone else put this here');

    await pruneAbandonedServerCaches();

    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('prunes the caches it can when one of them cannot be removed', async () => {
    const undeletable = abandonedCache('undeletable-app');
    const deletable = abandonedCache('deleted-app');

    fs.chmodSync(undeletable, 0o555);

    try {
      await expect(pruneAbandonedServerCaches()).resolves.toBeUndefined();

      expect(fs.existsSync(undeletable)).toBe(true);
      expect(fs.existsSync(deletable)).toBe(false);
    } finally {
      fs.chmodSync(undeletable, 0o755);
    }
  });

  it('does nothing when no cache has ever been created', async () => {
    process.env.XDG_CACHE_HOME = path.join(tmp.path, 'never-used');

    await expect(pruneAbandonedServerCaches()).resolves.toBeUndefined();
  });
});
