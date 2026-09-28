import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { memory } from 'files-sdk/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFilesystemBucket } from '#server/storage/providers/filesystem.ts';

describe('createFilesystemBucket', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'typebase-filesystem-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('keeps the bucket in its own directory under the configured root, under its prefix', async () => {
    const bucket = createFilesystemBucket({ name: 'avatars', bucket: { prefix: 'users' }, options: { root }, resources: {} });

    await bucket.upload('me.txt', 'hello');

    expect(readFileSync(path.join(root, 'avatars', 'users', 'me.txt'), 'utf8')).toBe('hello');
  });

  it('defaults the root to a typebase-storage directory in the OS temp directory', async () => {
    const name = `test-${process.pid}-${Date.now()}`;
    const bucketDirPath = path.join(tmpdir(), 'typebase-storage', name);

    try {
      await createFilesystemBucket({ name, bucket: {}, options: undefined, resources: {} }).upload('a.txt', 'hello');

      expect(existsSync(path.join(bucketDirPath, 'a.txt'))).toBe(true);
    } finally {
      rmSync(bucketDirPath, { recursive: true, force: true });
    }
  });

  it('builds the bucket on the adapter it is given, by bucket name, instead of the disk', async () => {
    const adapter = memory();
    const names: string[] = [];

    const bucket = createFilesystemBucket({
      name: 'avatars',
      bucket: {},
      options: { root },
      resources: {
        adapter: (name) => {
          names.push(name);

          return adapter;
        },
      },
    });

    await bucket.upload('a.txt', 'hello');

    expect(names).toEqual(['avatars']);
    expect([...adapter.raw.keys()]).toEqual(['a.txt']);
    expect(existsSync(path.join(root, 'avatars'))).toBe(false);
  });
});
