import { describe, expectTypeOf, it } from 'vitest';

import { createStorage } from '#server/storage/create-storage.ts';
import { type StorageInstance, defineStorage } from '#server/storage/define-storage.ts';
import { createLocalStorage } from '#server/storage/local-storage/create-local-storage.ts';

const _config = defineStorage({ provider: 'filesystem', buckets: { avatars: {}, documents: { prefix: 'docs' } } });

type Storage = StorageInstance<typeof _config>;
type Bucket = ReturnType<Storage['bucket']>;

describe('defineStorage', () => {
  it('accepts a filesystem root', () => {
    defineStorage({ provider: 'filesystem', options: { root: '/tmp/files' }, buckets: { avatars: {} } });
  });

  it('refuses an option the provider does not have', () => {
    // @ts-expect-error -- `region` is not a filesystem option
    defineStorage({ provider: 'filesystem', options: { region: 'iad1' }, buckets: { avatars: {} } });
  });

  it('refuses `access` on a filesystem bucket', () => {
    // @ts-expect-error -- filesystem buckets have no access setting
    defineStorage({ provider: 'filesystem', buckets: { avatars: { access: 'public' } } });
  });

  it('refuses `access` on a filesystem bucket next to options it does have', () => {
    // @ts-expect-error -- filesystem buckets have no access setting
    defineStorage({ provider: 'filesystem', buckets: { avatars: { prefix: 'users', access: 'private' } } });
  });

  it('refuses a provider Typebase does not have', () => {
    // @ts-expect-error -- `memory` is not a storage provider
    defineStorage({ provider: 'memory', buckets: { avatars: {} } });
  });
});

describe('StorageInstance', () => {
  it('selects a bucket by one of the declared names', () => {
    expectTypeOf<Storage['bucket']>().parameter(0).toEqualTypeOf<'avatars' | 'documents'>();
  });

  it('refuses a bucket that was not declared', () => {
    const storage = createStorage(_config, {});

    // @ts-expect-error -- `invoices` is not a declared bucket
    storage.bucket('invoices');
  });

  it('exposes the files-sdk file operations', () => {
    expectTypeOf<Bucket>().toHaveProperty('upload');
    expectTypeOf<Bucket>().toHaveProperty('download');
    expectTypeOf<Bucket>().toHaveProperty('head');
    expectTypeOf<Bucket>().toHaveProperty('exists');
    expectTypeOf<Bucket>().toHaveProperty('delete');
    expectTypeOf<Bucket>().toHaveProperty('copy');
    expectTypeOf<Bucket>().toHaveProperty('move');
    expectTypeOf<Bucket>().toHaveProperty('list');
    expectTypeOf<Bucket>().toHaveProperty('listAll');
    expectTypeOf<Bucket>().toHaveProperty('search');
  });

  it('has no URL methods on a filesystem bucket', () => {
    expectTypeOf<Bucket>().not.toHaveProperty('publicUrl');
    expectTypeOf<Bucket>().not.toHaveProperty('signedUrl');
    expectTypeOf<Bucket>().not.toHaveProperty('signedUploadUrl');
    expectTypeOf<Bucket>().not.toHaveProperty('url');
  });

  it('is what createStorage returns', () => {
    expectTypeOf(createStorage(_config, {})).toEqualTypeOf<Storage>();
  });
});

describe.each(['vercel', 'cloudflare'] as const)('a %s storage', (provider) => {
  const config = defineStorage({ provider, buckets: { avatars: { access: 'public' }, documents: { access: 'private' } } });

  type CloudStorage = StorageInstance<typeof config>;

  const storage = createStorage(config, { local: createLocalStorage({ root: '/tmp/storage', url: 'http://127.0.0.1:8080/storage' }) });

  it('accepts `access` on a bucket', () => {
    defineStorage({ provider, buckets: { avatars: { access: 'public', prefix: 'users' }, documents: { access: 'private' } } });
  });

  it('refuses an access that is neither public nor private', () => {
    // @ts-expect-error -- `protected` is not a bucket access
    defineStorage({ provider, buckets: { avatars: { access: 'protected' } } });
  });

  it('gives a public bucket a permanent URL and no signed one', () => {
    expectTypeOf(storage.bucket('avatars')).toHaveProperty('publicUrl');
    expectTypeOf(storage.bucket('avatars')).not.toHaveProperty('signedUrl');
  });

  it('gives a private bucket a signed URL and no permanent one', () => {
    expectTypeOf(storage.bucket('documents')).toHaveProperty('signedUrl');
    expectTypeOf(storage.bucket('documents')).not.toHaveProperty('publicUrl');
  });

  it('refuses a bucket that declares no access', () => {
    // @ts-expect-error -- every bucket declares its access
    defineStorage({ provider, buckets: { avatars: {} } });

    // @ts-expect-error -- every bucket declares its access, even next to options it does have
    defineStorage({ provider, buckets: { avatars: { prefix: 'users' } } });
  });

  it('refuses `publicUrl` on a private bucket and `signedUrl` on a public one', () => {
    // @ts-expect-error -- a private bucket has no permanent URL
    void storage.bucket('documents').publicUrl;

    // @ts-expect-error -- a public bucket has no signed URL
    void storage.bucket('avatars').signedUrl;
  });

  it('gives every bucket a signed upload URL', () => {
    expectTypeOf(storage.bucket('avatars')).toHaveProperty('signedUploadUrl');
    expectTypeOf(storage.bucket('documents')).toHaveProperty('signedUploadUrl');
  });

  it("never exposes files-sdk's single `url`", () => {
    expectTypeOf(storage.bucket('avatars')).not.toHaveProperty('url');
    expectTypeOf(storage.bucket('documents')).not.toHaveProperty('url');
  });

  it('returns the permanent and signed URLs as strings', () => {
    expectTypeOf(storage.bucket('avatars').publicUrl).returns.toEqualTypeOf<Promise<string>>();
    expectTypeOf(storage.bucket('documents').signedUrl).returns.toEqualTypeOf<Promise<string>>();
    expectTypeOf(storage.bucket('documents').signedUrl).toBeCallableWith('a.txt', { expiresIn: 60 });
  });

  it('selects a bucket by one of the declared names', () => {
    expectTypeOf<CloudStorage['bucket']>().parameter(0).toEqualTypeOf<'avatars' | 'documents'>();
  });

  it('is what createStorage returns', () => {
    expectTypeOf(storage).toEqualTypeOf<CloudStorage>();
  });

  it('runs on local storage, which needs a root and a URL', () => {
    // @ts-expect-error -- local storage needs a URL
    createLocalStorage({ root: '/tmp/storage' });

    // @ts-expect-error -- local storage is created with createLocalStorage
    createStorage(config, { local: { root: '/tmp/storage' } });
  });
});

describe('provider options', () => {
  it('accepts a Vercel region', () => {
    defineStorage({ provider: 'vercel', options: { region: 'iad1' }, buckets: { avatars: { access: 'public' } } });
  });

  it('accepts an R2 location hint', () => {
    defineStorage({ provider: 'cloudflare', options: { locationHint: 'weur' }, buckets: { avatars: { access: 'public' } } });
  });

  it("refuses another provider's option", () => {
    // @ts-expect-error -- `locationHint` is a Cloudflare option
    defineStorage({ provider: 'vercel', options: { locationHint: 'weur' }, buckets: { avatars: { access: 'public' } } });

    // @ts-expect-error -- `root` is a filesystem option
    defineStorage({ provider: 'cloudflare', options: { root: '/tmp' }, buckets: { avatars: { access: 'public' } } });
  });

  it('refuses a location hint R2 does not have', () => {
    // @ts-expect-error -- `mars` is not an R2 location hint
    defineStorage({ provider: 'cloudflare', options: { locationHint: 'mars' }, buckets: { avatars: { access: 'public' } } });
  });
});
