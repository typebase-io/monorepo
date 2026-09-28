import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { memory } from 'files-sdk/memory';
import { type R2HttpOptions } from 'files-sdk/r2';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type PrivateBucket, type PublicBucket } from '#server/storage/bucket.ts';
import { createLocalStorage } from '#server/storage/local-storage/create-local-storage.ts';
import { createCloudflareBucket } from '#server/storage/providers/cloudflare.ts';

describe('createCloudflareBucket', () => {
  const keys = {
    accountId: 'account-1',
    accessKeyId: 'token-id-1',
    secretAccessKey: 'token-secret-1',
    buckets: JSON.stringify({ avatars: 'shop-avatars-dev', documents: 'shop-documents-dev' }),
    publicUrls: { avatars: 'https://pub-avatars.r2.dev' },
  };

  it('builds the bucket with the R2 adapter over the S3 API from the R2 keys, under its prefix', async () => {
    const adapter = memory();
    const built: R2HttpOptions[] = [];

    const bucket = createCloudflareBucket({
      name: 'documents',
      bucket: { access: 'private', prefix: 'docs' },
      resources: {
        ...keys,
        adapter: (options) => {
          built.push(options);

          return adapter;
        },
      },
    });

    await bucket.upload('d.txt', 'document');

    expect(built).toEqual([
      { bucket: 'shop-documents-dev', accountId: 'account-1', accessKeyId: 'token-id-1', secretAccessKey: 'token-secret-1', client: 'fetch' },
    ]);
    expect([...adapter.raw.keys()]).toEqual(['docs/d.txt']);
    expect(bucket).toHaveProperty('signedUrl');
  });

  it('builds a public bucket on R2 by default, with its URL under the public base URL', async () => {
    const bucket = createCloudflareBucket({ name: 'avatars', bucket: { access: 'public' }, resources: keys }) as PublicBucket;

    expect(await bucket.publicUrl('users/me.png')).toBe('https://pub-avatars.r2.dev/users/me.png');
  });

  it('fails naming the bucket when it has no R2 bucket', () => {
    expect(() => createCloudflareBucket({ name: 'invoices', bucket: { access: 'private' }, resources: keys })).toThrow(
      'TYPEBASE_STORAGE_R2_BUCKETS has no R2 bucket for the bucket `invoices`.'
    );
  });

  describe('on local storage', () => {
    let root: string;

    beforeEach(() => {
      root = mkdtempSync(path.join(tmpdir(), 'typebase-cloudflare-local-test-'));
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
    });

    it('builds the bucket on local storage, needing no R2 keys', async () => {
      const local = createLocalStorage({ root, url: 'http://localhost:8080/storage' });
      const bucket = createCloudflareBucket({ name: 'documents', bucket: { access: 'private' }, resources: { local } }) as PrivateBucket;

      await bucket.upload('d.txt', 'document');

      expect(await bucket.signedUrl('d.txt')).toMatch(/^http:\/\/localhost:8080\/storage\/documents\/d\.txt\?expires=\d+&signature=[0-9a-f]{64}$/);
    });
  });
});
