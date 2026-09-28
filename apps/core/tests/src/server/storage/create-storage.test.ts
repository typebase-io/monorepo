import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { type FilesPlugin } from 'files-sdk';
import { type MemoryAdapter, memory } from 'files-sdk/memory';
import { type R2HttpOptions } from 'files-sdk/r2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStorage } from '#server/storage/create-storage.ts';
import { defineStorage } from '#server/storage/define-storage.ts';
import { createLocalStorage } from '#server/storage/local-storage/create-local-storage.ts';

const inMemory = () => {
  const adapters = new Map<string, MemoryAdapter>();

  const adapter = (bucket: string) => {
    const existing = adapters.get(bucket);

    if (existing) {
      return existing;
    }

    const created = memory();

    adapters.set(bucket, created);

    return created;
  };

  return { adapter, keys: (bucket: string) => [...adapter(bucket).raw.keys()].sort() };
};

const collect = async <T>(iterable: AsyncIterable<T>) => {
  const items: T[] = [];

  for await (const item of iterable) {
    items.push(item);
  }

  return items;
};

describe('createStorage', () => {
  it('uploads to a bucket and downloads the same bytes back', async () => {
    const store = inMemory();
    const storage = createStorage(defineStorage({ provider: 'filesystem', buckets: { avatars: {} } }), { adapter: store.adapter });

    await storage.bucket('avatars').upload('a.txt', 'hello', { contentType: 'text/plain' });

    const file = await storage.bucket('avatars').download('a.txt');

    expect(await file.text()).toBe('hello');
    expect(file.type).toBe('text/plain');
  });

  it('keeps each bucket apart', async () => {
    const store = inMemory();
    const storage = createStorage(defineStorage({ provider: 'filesystem', buckets: { avatars: {}, documents: {} } }), { adapter: store.adapter });

    await storage.bucket('avatars').upload('a.txt', 'avatar');
    await storage.bucket('documents').upload('d.txt', 'document');

    expect(store.keys('avatars')).toEqual(['a.txt']);
    expect(store.keys('documents')).toEqual(['d.txt']);
    expect(await storage.bucket('avatars').exists('d.txt')).toBe(false);
  });

  it('refuses a bucket that was not declared', () => {
    const storage = createStorage(defineStorage({ provider: 'filesystem', buckets: { avatars: {} } }), { adapter: inMemory().adapter });

    expect(() => storage.bucket('documents' as never)).toThrow('Storage has no bucket named `documents`. Declare it in `storage.ts`.');
  });

  it('heads, checks, copies, moves, and deletes files', async () => {
    const store = inMemory();
    const bucket = createStorage(defineStorage({ provider: 'filesystem', buckets: { files: {} } }), { adapter: store.adapter }).bucket('files');

    await bucket.upload('a.txt', 'alpha', { contentType: 'text/plain' });

    expect((await bucket.head('a.txt')).size).toBe(5);
    expect(await bucket.exists('a.txt')).toBe(true);

    await bucket.copy('a.txt', 'b.txt');
    await bucket.move('b.txt', 'c.txt');

    expect(store.keys('files')).toEqual(['a.txt', 'c.txt']);

    await bucket.delete('a.txt');

    expect(store.keys('files')).toEqual(['c.txt']);
  });

  it('lists, walks, and searches files', async () => {
    const bucket = createStorage(defineStorage({ provider: 'filesystem', buckets: { files: {} } }), { adapter: inMemory().adapter }).bucket('files');

    await bucket.upload('photos/a.jpg', 'a');
    await bucket.upload('photos/b.png', 'b');
    await bucket.upload('notes.txt', 'n');

    expect((await bucket.list({ prefix: 'photos/' })).items.map((file) => file.key)).toEqual(['photos/a.jpg', 'photos/b.png']);
    expect((await collect(bucket.listAll())).map((file) => file.key).sort()).toEqual(['notes.txt', 'photos/a.jpg', 'photos/b.png']);
    expect((await collect(bucket.search('photos/*.jpg'))).map((file) => file.key)).toEqual(['photos/a.jpg']);
  });

  it("passes each bucket's prefix, plugins, and hooks to files-sdk", async () => {
    const store = inMemory();
    const onAction = vi.fn();
    const wrapped: string[] = [];

    const plugin: FilesPlugin = {
      name: 'record',
      wrap: (op, next) => {
        wrapped.push(op.kind);

        return next(op);
      },
    };

    const storage = createStorage(
      defineStorage({ provider: 'filesystem', buckets: { avatars: { prefix: 'users', plugins: [plugin], hooks: { onAction } }, documents: {} } }),
      { adapter: store.adapter }
    );

    await storage.bucket('avatars').upload('a.txt', 'hello');
    await storage.bucket('documents').upload('d.txt', 'hello');

    expect(store.keys('avatars')).toEqual(['users/a.txt']);
    expect(store.keys('documents')).toEqual(['d.txt']);
    expect(wrapped).toEqual(['upload']);
    await vi.waitFor(() => {
      expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'upload', key: 'a.txt' }));
    });
  });

  it.each(['Avatars', 'my_files', '-avatars', 'avatars-', 'a'.repeat(33), ''])('rejects the bucket name %j, naming it', (name) => {
    expect(() => createStorage(defineStorage({ provider: 'filesystem', buckets: { [name]: {} } }), {})).toThrow(`\`${name}\``);
  });

  it('accepts bucket names made of lowercase letters, digits, and hyphens', () => {
    expect(() => createStorage(defineStorage({ provider: 'filesystem', buckets: { 'user-avatars-2': {}, a: {} } }), {})).not.toThrow();
  });
});

describe('createStorage on the filesystem', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'typebase-storage-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('keeps each bucket in its own directory under the configured root', async () => {
    const storage = createStorage(defineStorage({ provider: 'filesystem', options: { root }, buckets: { avatars: {} } }), {});

    await storage.bucket('avatars').upload('a.txt', 'hello');

    expect(readFileSync(path.join(root, 'avatars', 'a.txt'), 'utf8')).toBe('hello');
  });

  it('defaults the root to a typebase-storage directory in the OS temp directory', async () => {
    const bucketName = `test-${process.pid}-${Date.now()}`;
    const bucketDirPath = path.join(tmpdir(), 'typebase-storage', bucketName);

    try {
      const storage = createStorage(defineStorage({ provider: 'filesystem', buckets: { [bucketName]: {} } }), {});

      await storage.bucket(bucketName).upload('a.txt', 'hello');

      expect(existsSync(path.join(bucketDirPath, 'a.txt'))).toBe(true);
    } finally {
      rmSync(bucketDirPath, { recursive: true, force: true });
    }
  });
});

describe.each(['vercel', 'cloudflare'] as const)('createStorage for %s on local storage', (provider) => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'typebase-local-storage-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const config = defineStorage({ provider, buckets: { avatars: { access: 'public' }, documents: { access: 'private', prefix: 'docs' } } });

  it('keeps each bucket in its own directory under the local root', async () => {
    const storage = createStorage(config, { local: createLocalStorage({ root, url: 'http://127.0.0.1:8080/storage' }) });

    await storage.bucket('avatars').upload('a.txt', 'avatar');
    await storage.bucket('documents').upload('d.txt', 'document');

    expect(readFileSync(path.join(root, 'avatars', 'a.txt'), 'utf8')).toBe('avatar');
    expect(readFileSync(path.join(root, 'documents', 'docs', 'd.txt'), 'utf8')).toBe('document');
    expect(await storage.bucket('avatars').exists('d.txt')).toBe(false);
  });

  it('finds the files an earlier instance wrote to the same root', async () => {
    await createStorage(config, { local: createLocalStorage({ root, url: 'http://127.0.0.1:8080/storage' }) })
      .bucket('avatars')
      .upload('a.txt', 'hello');

    const file = await createStorage(config, { local: createLocalStorage({ root, url: 'http://127.0.0.1:8080/storage' }) })
      .bucket('avatars')
      .download('a.txt');

    expect(await file.text()).toBe('hello');
  });

  it('refuses a bucket that was not declared', () => {
    const storage = createStorage(config, { local: createLocalStorage({ root, url: 'http://127.0.0.1:8080/storage' }) });

    expect(() => storage.bucket('invoices' as never)).toThrow('Storage has no bucket named `invoices`. Declare it in `storage.ts`.');
  });
});

describe('createStorage for vercel on Blob stores', () => {
  const config = defineStorage({ provider: 'vercel', buckets: { avatars: { access: 'public' }, documents: { access: 'private', prefix: 'docs' } } });
  const tokens = JSON.stringify({ avatars: 'vercel_blob_rw_avatarsStore1_secret', documents: 'vercel_blob_rw_documentsStore1_secret' });

  const recordingAdapters = () => {
    const built: { token: string; access: string }[] = [];
    const store = inMemory();

    const adapter = ({ token, access }: { token: string; access: 'public' | 'private' }) => {
      built.push({ token, access });

      return store.adapter(token);
    };

    return { built, adapter, keys: store.keys };
  };

  it('builds each bucket from its token and its declared access', async () => {
    const { built, adapter, keys } = recordingAdapters();
    const storage = createStorage(
      defineStorage({ provider: 'vercel', buckets: { avatars: { access: 'public' }, invoices: { access: 'private' } } }),
      {
        tokens: JSON.stringify({ avatars: 'avatars-token', invoices: 'invoices-token' }),
        adapter,
      }
    );

    await storage.bucket('avatars').upload('a.txt', 'avatar');
    await storage.bucket('invoices').upload('i.txt', 'invoice');

    expect(built).toEqual([
      { token: 'avatars-token', access: 'public' },
      { token: 'invoices-token', access: 'private' },
    ]);
    expect(keys('avatars-token')).toEqual(['a.txt']);
    expect(keys('invoices-token')).toEqual(['i.txt']);
  });

  it("passes each bucket's prefix to files-sdk", async () => {
    const { adapter, keys } = recordingAdapters();
    const storage = createStorage(config, { tokens, adapter });

    await storage.bucket('documents').upload('d.txt', 'document');

    expect(keys('vercel_blob_rw_documentsStore1_secret')).toEqual(['docs/d.txt']);
  });

  it("returns a public bucket's permanent Blob store URL", async () => {
    const storage = createStorage(config, { tokens });

    expect(await storage.bucket('avatars').publicUrl('users/me.png')).toBe('https://avatarsStore1.public.blob.vercel-storage.com/users/me.png');
  });

  it("signs a private bucket's URL through the store, with the requested expiry", async () => {
    const { adapter } = recordingAdapters();
    const bucket = createStorage(config, { tokens, adapter }).bucket('documents');

    await bucket.upload('d.pdf', 'document');

    expect(await bucket.signedUrl('d.pdf', { expiresIn: 60 })).toBe('memory://docs/d.pdf?expires=60');
  });

  it('fails naming the bucket and the variable when a declared bucket has no token', () => {
    expect(() => createStorage(config, { tokens: JSON.stringify({ avatars: 'vercel_blob_rw_avatarsStore1_secret' }) })).toThrow(
      'TYPEBASE_STORAGE_VERCEL_TOKENS has no token for the bucket `documents`. Run `npx typebase-io-cli storage sync <target>` to create the bucket and write its token.'
    );
  });

  it('fails naming the variable when it is not set', () => {
    expect(() => createStorage(config, { tokens: undefined })).toThrow(
      'TYPEBASE_STORAGE_VERCEL_TOKENS is not set. Run `npx typebase-io-cli storage sync <target>` to create the buckets and write their tokens.'
    );
  });

  it.each(['not json', '[]', '"token"', '{"avatars":1}'])('fails naming the variable when it holds %j', (value) => {
    expect(() => createStorage(config, { tokens: value })).toThrow(
      'TYPEBASE_STORAGE_VERCEL_TOKENS must be a JSON object from bucket name to Blob store token.'
    );
  });
});

describe('createStorage for cloudflare on R2', () => {
  const config = defineStorage({
    provider: 'cloudflare',
    buckets: { avatars: { access: 'public' }, documents: { access: 'private', prefix: 'docs' } },
  });

  const keys = {
    accountId: 'account-1',
    accessKeyId: 'token-id-1',
    secretAccessKey: 'token-secret-1',
    buckets: JSON.stringify({ avatars: 'shop-avatars-dev', documents: 'shop-documents-dev' }),
    publicUrls: { avatars: 'https://pub-avatars.r2.dev' },
  };

  const recordingAdapters = () => {
    const built: R2HttpOptions[] = [];
    const store = inMemory();

    const adapter = (options: R2HttpOptions) => {
      built.push(options);

      return store.adapter(options.bucket);
    };

    return { built, adapter, keys: store.keys };
  };

  it('builds each bucket with the R2 adapter over the S3 API from the R2 keys, with no Workers binding', async () => {
    const { built, adapter, keys: storedKeys } = recordingAdapters();
    const storage = createStorage(config, { ...keys, adapter });

    await storage.bucket('avatars').upload('a.txt', 'avatar');
    await storage.bucket('documents').upload('d.txt', 'document');

    expect(built).toEqual([
      {
        bucket: 'shop-avatars-dev',
        accountId: 'account-1',
        accessKeyId: 'token-id-1',
        secretAccessKey: 'token-secret-1',
        publicBaseUrl: 'https://pub-avatars.r2.dev',
        client: 'fetch',
      },
      {
        bucket: 'shop-documents-dev',
        accountId: 'account-1',
        accessKeyId: 'token-id-1',
        secretAccessKey: 'token-secret-1',
        client: 'fetch',
      },
    ]);
    expect(storedKeys('shop-avatars-dev')).toEqual(['a.txt']);
    expect(storedKeys('shop-documents-dev')).toEqual(['docs/d.txt']);
  });

  it("returns a public bucket's URL under its public base URL", async () => {
    const storage = createStorage(config, keys);

    expect(await storage.bucket('avatars').publicUrl('users/me.png')).toBe('https://pub-avatars.r2.dev/users/me.png');
  });

  it("presigns a private bucket's URL against the R2 S3 endpoint, with the requested expiry", async () => {
    const url = new URL(await createStorage(config, keys).bucket('documents').signedUrl('d.pdf', { expiresIn: 60 }));

    expect(`${url.origin}${url.pathname}`).toBe('https://account-1.r2.cloudflarestorage.com/shop-documents-dev/docs/d.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(/^token-id-1\//);
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['accountId', 'TYPEBASE_STORAGE_R2_ACCOUNT_ID'],
    ['accessKeyId', 'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID'],
    ['secretAccessKey', 'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY'],
    ['buckets', 'TYPEBASE_STORAGE_R2_BUCKETS'],
  ] as const)('fails naming the variable when %s is missing', (resource, variable) => {
    expect(() => createStorage(config, { ...keys, [resource]: undefined })).toThrow(
      `${variable} is not set. Run \`npx typebase-io-cli storage sync <target>\` to create the buckets and write their keys.`
    );
  });

  it('fails naming the bucket and the variable when a declared bucket has no R2 bucket', () => {
    expect(() => createStorage(config, { ...keys, buckets: JSON.stringify({ avatars: 'shop-avatars-dev' }) })).toThrow(
      'TYPEBASE_STORAGE_R2_BUCKETS has no R2 bucket for the bucket `documents`. Run `npx typebase-io-cli storage sync <target>` to create the bucket and write its keys.'
    );
  });

  it.each(['not json', '[]', '"shop-avatars-dev"', '{"avatars":1}'])('fails naming the variable when the buckets hold %j', (value) => {
    expect(() => createStorage(config, { ...keys, buckets: value })).toThrow(
      'TYPEBASE_STORAGE_R2_BUCKETS must be a JSON object from bucket name to R2 bucket name.'
    );
  });

  it('fails naming the variable when a public bucket has no public base URL', () => {
    const storage = () =>
      createStorage(defineStorage({ provider: 'cloudflare', buckets: { 'user-avatars': { access: 'public' } } }), {
        ...keys,
        buckets: JSON.stringify({ 'user-avatars': 'shop-user-avatars-dev' }),
        publicUrls: {},
      });

    expect(storage).toThrow(
      'TYPEBASE_STORAGE_R2_PUBLIC_URL_USER_AVATARS is not set, and the public bucket `user-avatars` needs it for its URLs. Run `npx typebase-io-cli storage sync <target>` to enable its r2.dev domain and write its keys.'
    );
  });
});
