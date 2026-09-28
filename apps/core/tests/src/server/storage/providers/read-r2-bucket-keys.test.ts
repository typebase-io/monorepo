import { describe, expect, it } from 'vitest';

import { type R2Keys, readR2BucketKeys } from '#server/storage/providers/read-r2-bucket-keys.ts';

describe('readR2BucketKeys', () => {
  const keys: R2Keys = {
    accountId: 'account-1',
    accessKeyId: 'token-id-1',
    secretAccessKey: 'token-secret-1',
    buckets: JSON.stringify({ avatars: 'shop-avatars-dev', 'user-files': 'shop-user-files-dev', documents: 'shop-documents-dev' }),
    publicUrls: { avatars: 'https://pub-avatars.r2.dev' },
  };

  const shared = { accountId: 'account-1', accessKeyId: 'token-id-1', secretAccessKey: 'token-secret-1' };

  it('reads the R2 bucket and keys of a private bucket, with no public URL', () => {
    expect(readR2BucketKeys(keys, 'documents', 'private')).toEqual({ bucket: 'shop-documents-dev', ...shared });
  });

  it('reads the public base URL of a public bucket too', () => {
    expect(readR2BucketKeys(keys, 'avatars', 'public')).toEqual({
      bucket: 'shop-avatars-dev',
      ...shared,
      publicBaseUrl: 'https://pub-avatars.r2.dev',
    });
  });

  it.each([
    ['accountId', 'TYPEBASE_STORAGE_R2_ACCOUNT_ID'],
    ['accessKeyId', 'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID'],
    ['secretAccessKey', 'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY'],
    ['buckets', 'TYPEBASE_STORAGE_R2_BUCKETS'],
  ] as const)('fails naming the variable when %s is missing or empty', (resource, variable) => {
    const message = `${variable} is not set. Run \`npx typebase-io-cli storage sync <target>\` to create the buckets and write their keys.`;

    expect(() => readR2BucketKeys({ ...keys, [resource]: undefined }, 'documents', 'private')).toThrow(message);
    expect(() => readR2BucketKeys({ ...keys, [resource]: '' }, 'documents', 'private')).toThrow(message);
  });

  it.each(['not json', '[]', '{"documents":1}'])('fails naming the variable when the buckets hold %j', (buckets) => {
    expect(() => readR2BucketKeys({ ...keys, buckets }, 'documents', 'private')).toThrow(
      'TYPEBASE_STORAGE_R2_BUCKETS must be a JSON object from bucket name to R2 bucket name.'
    );
  });

  it('fails naming the bucket when it has no R2 bucket', () => {
    expect(() => readR2BucketKeys(keys, 'invoices', 'private')).toThrow(
      'TYPEBASE_STORAGE_R2_BUCKETS has no R2 bucket for the bucket `invoices`. Run `npx typebase-io-cli storage sync <target>` to create the bucket and write its keys.'
    );
  });

  it.each([
    { name: 'no public URLs at all', publicUrls: undefined },
    { name: 'no public URL for the bucket', publicUrls: {} },
  ])('fails naming the variable, with dashes as underscores, when a public bucket has $name', ({ publicUrls }) => {
    expect(() => readR2BucketKeys({ ...keys, publicUrls }, 'user-files', 'public')).toThrow(
      'TYPEBASE_STORAGE_R2_PUBLIC_URL_USER_FILES is not set, and the public bucket `user-files` needs it for its URLs. Run `npx typebase-io-cli storage sync <target>` to enable its r2.dev domain and write its keys.'
    );
  });
});
