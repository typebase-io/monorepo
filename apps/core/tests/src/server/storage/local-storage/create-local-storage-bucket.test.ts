import { Files } from 'files-sdk';
import { memory } from 'files-sdk/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUCKET_OPERATIONS, type PrivateBucket, type PublicBucket } from '#server/storage/bucket.ts';
import { createLocalStorageBucket } from '#server/storage/local-storage/create-local-storage-bucket.ts';
import { hasValidLocalStorageSignature } from '#server/storage/local-storage/has-valid-local-storage-signature.ts';

describe('createLocalStorageBucket', () => {
  const BASE_URL = 'http://localhost:8080/storage';

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const build = (access: 'public' | 'private') => {
    const files = new Files({ adapter: memory() });

    return { files, bucket: createLocalStorageBucket({ name: 'avatars', files, access, baseUrl: BASE_URL, secret: 'secret' }) };
  };

  const isSignedFor = (url: string, method: 'GET' | 'PUT') => {
    const { pathname, searchParams } = new URL(url);

    return hasValidLocalStorageSignature({
      secret: 'secret',
      method,
      bucket: 'avatars',
      key: decodeURIComponent(pathname.replace('/storage/avatars/', '')),
      params: searchParams,
    });
  };

  it('keeps the files in the files it is given', async () => {
    const { files, bucket } = build('private');

    await bucket.upload('a.txt', 'hello');

    expect(await (await files.download('a.txt')).text()).toBe('hello');
    expect(Object.keys(bucket).sort()).toEqual([...BUCKET_OPERATIONS, 'signedUploadUrl', 'signedUrl'].sort());
  });

  it('gives a public bucket a permanent, unsigned URL and no signed one', async () => {
    const bucket = build('public').bucket as PublicBucket;

    expect(bucket).not.toHaveProperty('signedUrl');
    expect(await bucket.publicUrl('users/me 1.png')).toBe(`${BASE_URL}/avatars/users/me%201.png`);
  });

  it('gives a private bucket a download URL signed for an hour by default, and no public one', async () => {
    const bucket = build('private').bucket as PrivateBucket;
    const url = await bucket.signedUrl('d.pdf');

    expect(bucket).not.toHaveProperty('publicUrl');
    expect(new URL(url).searchParams.get('expires')).toBe(String(1000 + 3600));
    expect(isSignedFor(url, 'GET')).toBe(true);
    expect(isSignedFor(url, 'PUT')).toBe(false);
  });

  it('signs the expiry and disposition a private download URL asks for', async () => {
    const url = new URL(
      await (build('private').bucket as PrivateBucket).signedUrl('d.pdf', { expiresIn: 60, responseContentDisposition: 'attachment' })
    );

    expect(url.searchParams.get('expires')).toBe('1060');
    expect(url.searchParams.get('disposition')).toBe('attachment');
  });

  it.each(['public', 'private'] as const)('signs an upload URL for a %s bucket that only uploads', async (access) => {
    const upload = await (build(access).bucket as PublicBucket).signedUploadUrl('a.png', { expiresIn: 60 });

    expect(upload).toEqual({ method: 'PUT', url: expect.any(String) as string });
    expect(isSignedFor(upload.url, 'PUT')).toBe(true);
    expect(isSignedFor(upload.url, 'GET')).toBe(false);
    expect([...new URL(upload.url).searchParams.keys()]).toEqual(['expires', 'signature']);
  });

  it('holds an upload URL to its content type, and tells the browser which to send', async () => {
    const upload = await (build('public').bucket as PublicBucket).signedUploadUrl('a.png', { expiresIn: 60, contentType: 'image/png' });

    expect(upload).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/png' } });
    expect(new URL(upload.url).searchParams.get('content-type')).toBe('image/png');
  });

  it('holds an upload URL to its size, needing at least one byte unless a minimum is given', async () => {
    const bucket = build('public').bucket as PublicBucket;

    const params = async (options: { maxSize?: number; minSize?: number }) =>
      new URL((await bucket.signedUploadUrl('a.png', { expiresIn: 60, ...options })).url).searchParams;

    expect((await params({ maxSize: 100 })).get('max-size')).toBe('100');
    expect((await params({ maxSize: 100 })).get('min-size')).toBe('1');
    expect((await params({ maxSize: 100, minSize: 10 })).get('min-size')).toBe('10');
    expect((await params({ minSize: 10 })).has('min-size')).toBe(false);
  });
});
