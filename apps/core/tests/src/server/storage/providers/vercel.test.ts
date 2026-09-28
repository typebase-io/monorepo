import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { memory } from 'files-sdk/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type PrivateBucket, type PublicBucket } from '#server/storage/bucket.ts';
import { createLocalStorage } from '#server/storage/local-storage/create-local-storage.ts';
import { createVercelBucket } from '#server/storage/providers/vercel.ts';

describe('createVercelBucket', () => {
  const tokens = JSON.stringify({ avatars: 'vercel_blob_rw_avatarsStore1_secret', documents: 'vercel_blob_rw_documentsStore1_secret' });

  it('builds the bucket from its token and declared access, under its prefix', async () => {
    const adapter = memory();
    const built: { token: string; access: string }[] = [];

    const bucket = createVercelBucket({
      name: 'documents',
      bucket: { access: 'private', prefix: 'docs' },
      resources: {
        tokens,
        adapter: (args) => {
          built.push(args);

          return adapter;
        },
      },
    });

    await bucket.upload('d.txt', 'document');

    expect(built).toEqual([{ token: 'vercel_blob_rw_documentsStore1_secret', access: 'private' }]);
    expect([...adapter.raw.keys()]).toEqual(['docs/d.txt']);
    expect(bucket).toHaveProperty('signedUrl');
  });

  it('builds a public bucket on the Blob store by default, with its permanent URL', async () => {
    const bucket = createVercelBucket({ name: 'avatars', bucket: { access: 'public' }, resources: { tokens } }) as PublicBucket;

    expect(await bucket.publicUrl('users/me.png')).toBe('https://avatarsStore1.public.blob.vercel-storage.com/users/me.png');
  });

  it('fails naming the bucket when it has no token', () => {
    expect(() => createVercelBucket({ name: 'invoices', bucket: { access: 'private' }, resources: { tokens } })).toThrow(
      'TYPEBASE_STORAGE_VERCEL_TOKENS has no token for the bucket `invoices`.'
    );
  });

  describe('on local storage', () => {
    let root: string;

    beforeEach(() => {
      root = mkdtempSync(path.join(tmpdir(), 'typebase-vercel-local-test-'));
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
    });

    it('builds the bucket on local storage, needing no token', async () => {
      const local = createLocalStorage({ root, url: 'http://localhost:8080/storage' });
      const bucket = createVercelBucket({ name: 'documents', bucket: { access: 'private' }, resources: { local } }) as PrivateBucket;

      await bucket.upload('d.txt', 'document');

      expect(await bucket.signedUrl('d.txt')).toMatch(/^http:\/\/localhost:8080\/storage\/documents\/d\.txt\?expires=\d+&signature=[0-9a-f]{64}$/);
    });
  });
});
