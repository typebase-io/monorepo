import { Files } from 'files-sdk';
import { memory } from 'files-sdk/memory';
import { describe, expect, it } from 'vitest';

import { BUCKET_OPERATIONS, type PrivateBucket, type PublicBucket } from '#server/storage/bucket.ts';
import { createFilesBucket } from '#server/storage/create-files-bucket.ts';

describe('createFilesBucket', () => {
  const build = (access: 'public' | 'private') => {
    const files = new Files({ adapter: memory() });

    return { files, bucket: createFilesBucket({ files, access }) };
  };

  it('exposes every bucket operation, bound to the files it wraps', async () => {
    const { files, bucket } = build('private');

    for (const operation of BUCKET_OPERATIONS) {
      expect(bucket[operation]).toBeTypeOf('function');
    }

    const { upload } = bucket;

    await upload('a.txt', 'hello');

    expect(await (await files.download('a.txt')).text()).toBe('hello');
  });

  it('keeps everything else files-sdk has out of the bucket', () => {
    const { bucket } = build('private');

    expect(Object.keys(bucket).sort()).toEqual([...BUCKET_OPERATIONS, 'signedUploadUrl', 'signedUrl'].sort());
  });

  it('gives a public bucket a permanent URL and no signed one', async () => {
    const { bucket } = build('public');

    await bucket.upload('me.png', 'avatar');

    expect(bucket).not.toHaveProperty('signedUrl');
    expect(await (bucket as PublicBucket).publicUrl('me.png')).toBe('memory://me.png');
  });

  it('gives a private bucket a signed URL with the requested expiry and disposition, and no public one', async () => {
    const { bucket } = build('private');

    await bucket.upload('d.pdf', 'document');

    expect(bucket).not.toHaveProperty('publicUrl');
    expect(await (bucket as PrivateBucket).signedUrl('d.pdf', { expiresIn: 60, responseContentDisposition: 'attachment' })).toBe(
      'memory://d.pdf?expires=60&response-content-disposition=attachment'
    );
  });

  it.each(['public', 'private'] as const)('signs upload URLs for a %s bucket', async (access) => {
    const { bucket } = build(access);

    expect(await (bucket as PublicBucket).signedUploadUrl('a.png', { expiresIn: 60, contentType: 'image/png' })).toEqual({
      method: 'PUT',
      url: 'memory://a.png?expires=60',
      headers: { 'Content-Type': 'image/png' },
    });
  });
});
