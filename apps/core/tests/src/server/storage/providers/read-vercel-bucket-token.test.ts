import { describe, expect, it } from 'vitest';

import { readVercelBucketToken } from '#server/storage/providers/read-vercel-bucket-token.ts';

describe('readVercelBucketToken', () => {
  const tokens = JSON.stringify({ avatars: 'avatars-token', documents: 'documents-token' });

  it('reads the token of the bucket', () => {
    expect(readVercelBucketToken(tokens, 'documents')).toBe('documents-token');
  });

  it.each([undefined, ''])('fails naming the variable when it is %j', (value) => {
    expect(() => readVercelBucketToken(value, 'avatars')).toThrow(
      'TYPEBASE_STORAGE_VERCEL_TOKENS is not set. Run `npx typebase-io-cli storage sync <target>` to create the buckets and write their tokens.'
    );
  });

  it.each(['not json', '[]', '{"avatars":1}'])('fails naming the variable when it holds %j', (value) => {
    expect(() => readVercelBucketToken(value, 'avatars')).toThrow(
      'TYPEBASE_STORAGE_VERCEL_TOKENS must be a JSON object from bucket name to Blob store token.'
    );
  });

  it.each([
    { name: 'missing', value: JSON.stringify({ documents: 'documents-token' }) },
    { name: 'empty', value: JSON.stringify({ avatars: '' }) },
  ])('fails naming the bucket when its token is $name', ({ value }) => {
    expect(() => readVercelBucketToken(value, 'avatars')).toThrow(
      'TYPEBASE_STORAGE_VERCEL_TOKENS has no token for the bucket `avatars`. Run `npx typebase-io-cli storage sync <target>` to create the bucket and write its token.'
    );
  });
});
