import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type BucketAccess } from '#helpers/constants.ts';
import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { vercel } from '#helpers/storage/vercel/index.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const blob = vi.hoisted(() => ({
  stores: [] as { id: string; name: string; access: BucketAccess }[],
  created: [] as { name: string; access: BucketAccess; region: string | undefined }[],
}));

vi.mock('#helpers/deploy/vercel/get-vercel-token.ts', () => ({ getVercelToken: vi.fn(() => Promise.resolve('vercel-token')) }));

vi.mock('#helpers/deploy/vercel/client.ts', () => ({
  VercelClient: vi.fn(function () {
    return {
      listTeams: vi.fn(() => Promise.resolve([{ id: 'team_new', name: 'New', slug: 'new' }])),
      listStores: vi.fn(() => Promise.resolve([...blob.stores])),
      createStore: vi.fn((store: { name: string; access: BucketAccess; region: string | undefined }) => {
        blob.created.push(store);

        return Promise.resolve({ id: `store_${store.name}`, name: store.name, access: store.access });
      }),
      getStoreToken: vi.fn(({ id }: { id: string }) => Promise.resolve(`vercel_blob_rw_${id}`)),
    };
  }),
}));

describe('vercel storage client', () => {
  let tmp: TempDir;

  const connect = (config: Record<string, unknown> = { storage: { vercel: { orgId: 'team_acme' } } }, region?: string) => {
    tmp.write('typebase.json', JSON.stringify(config));

    return withCwd(tmp.path, async () => vercel({ region, config: await getTypebaseConfig() }));
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();

    blob.stores = [];
    blob.created = [];
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('works against the saved team with the CLI token, and reports no new account', async () => {
    const { newAccount } = await connect();

    expect(VercelClient).toHaveBeenCalledWith({ token: 'vercel-token', orgId: 'team_acme' });
    expect(newAccount).toBeUndefined();
  });

  it('reports the team it asked for, so it can be saved', async () => {
    vi.mocked(select).mockResolvedValue('team_new');

    const { newAccount } = await connect({});

    expect(VercelClient).toHaveBeenLastCalledWith({ token: 'vercel-token', orgId: 'team_new' });
    expect(newAccount).toEqual({ vercel: { orgId: 'team_new' } });
  });

  it('lists every Blob store the team holds with its access', async () => {
    blob.stores = [
      { id: 'store_1', name: 'app-avatars-dev', access: 'public' },
      { id: 'store_2', name: 'app-documents-dev', access: 'private' },
    ];

    const { client } = await connect();

    await expect(client.listBuckets()).resolves.toEqual(blob.stores);
  });

  it('creates a Blob store in the declared region', async () => {
    const { client } = await connect(undefined, 'iad1');

    await client.createBucket({ name: 'app-avatars-dev', access: 'public' });

    expect(blob.created).toEqual([{ name: 'app-avatars-dev', access: 'public', region: 'iad1' }]);
  });

  it('gives one token per bucket, for listed and created stores alike, keyed by the declared bucket', async () => {
    blob.stores = [{ id: 'store_existing', name: 'app-avatars-dev', access: 'public' }];

    const { client } = await connect();

    await client.listBuckets();
    await client.createBucket({ name: 'app-documents-dev', access: 'private' });

    await expect(
      client.getCredentials(
        [
          { bucket: 'avatars', name: 'app-avatars-dev', access: 'public' },
          { bucket: 'documents', name: 'app-documents-dev', access: 'private' },
        ],
        () => undefined
      )
    ).resolves.toEqual([
      {
        key: 'TYPEBASE_STORAGE_VERCEL_TOKENS',
        value: JSON.stringify({ avatars: 'vercel_blob_rw_store_existing', documents: 'vercel_blob_rw_store_app-documents-dev' }),
      },
    ]);
  });

  it('fails naming the bucket when its Blob store was neither listed nor created', async () => {
    const { client } = await connect();

    await expect(client.getCredentials([{ bucket: 'avatars', name: 'app-avatars-dev', access: 'public' }], () => undefined)).rejects.toThrow(
      'The Blob store `app-avatars-dev` for the bucket `avatars` was not found on Vercel.'
    );
  });
});
