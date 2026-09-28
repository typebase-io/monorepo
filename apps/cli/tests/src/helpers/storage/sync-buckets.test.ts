import path from 'node:path';

import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type BucketAccess } from '#helpers/constants.ts';
import { cloudflare } from '#helpers/storage/cloudflare/index.ts';
import { type StorageProviderClient } from '#helpers/storage/storage-provider-client.ts';
import { syncBuckets } from '#helpers/storage/sync-buckets.ts';
import { vercel } from '#helpers/storage/vercel/index.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const provider = vi.hoisted(() => ({
  buckets: [] as { name: string; access: BucketAccess }[],
  events: [] as string[],
  newAccount: undefined as object | undefined,
}));

vi.mock('#helpers/storage/vercel/index.ts', () => ({ vercel: vi.fn() }));
vi.mock('#helpers/storage/cloudflare/index.ts', () => ({ cloudflare: vi.fn() }));

const fakeClient = (): StorageProviderClient => ({
  listBuckets: () => Promise.resolve([...provider.buckets]),
  createBucket: ({ name, access }) => {
    provider.events.push(`create ${name} ${access}`);
    provider.buckets.push({ name, access });

    return Promise.resolve();
  },
  getCredentials: (buckets, stored) =>
    Promise.resolve([{ key: 'STORAGE_KEY', value: `${buckets.map(({ bucket }) => bucket).join(',')}|${stored('STORAGE_KEY') ?? 'none'}` }]),
});

const storageFile = (declaredProvider: string, options = '') => `import { defineStorage } from "typebase-io/server";

export const storage = defineStorage({
  provider: "${declaredProvider}",
  buckets: {
    avatars: { access: "public" },
    documents: { access: "private" },
  },${options}
});
`;

describe('syncBuckets', () => {
  let tmp: TempDir;

  const sync = (target: 'dev' | 'prod' = 'dev') =>
    withCwd(tmp.path, () => syncBuckets({ target, storageFilePath: path.join(tmp.path, 'typebase/storage.ts') }));

  const logged = () => vi.mocked(console.log).mock.calls.map(([line]) => String(line));
  const succeeded = () => vi.mocked(ora()).succeed.mock.calls.flat();

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();

    provider.buckets = [];
    provider.events = [];
    provider.newAccount = undefined;

    vi.mocked(vercel).mockImplementation(() => Promise.resolve({ client: fakeClient(), newAccount: provider.newAccount as never }));
    vi.mocked(cloudflare).mockImplementation(() => Promise.resolve({ client: fakeClient(), newAccount: provider.newAccount as never }));

    tmp.write('typebase.json', JSON.stringify({ storage: { project: 'app' } }));
    tmp.write('typebase/storage.ts', storageFile('vercel'));

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('creates every declared bucket that is missing, named after the project, bucket and target', async () => {
    await sync();

    expect(provider.events).toEqual(['create app-avatars-dev public', 'create app-documents-dev private']);
    expect(logged()).toEqual(['Buckets to create for dev:\n  app-avatars-dev (public)\n  app-documents-dev (private)']);
  });

  it('adopts the buckets that already exist and creates only the missing ones', async () => {
    provider.buckets = [{ name: 'app-avatars-dev', access: 'public' }];

    await sync();

    expect(provider.events).toEqual(['create app-documents-dev private']);
  });

  it('creates nothing when every bucket already exists', async () => {
    provider.buckets = [
      { name: 'app-avatars-dev', access: 'public' },
      { name: 'app-documents-dev', access: 'private' },
    ];

    await sync();

    expect(provider.events).toEqual([]);
    expect(logged()).toEqual(['All buckets for dev already exist.']);
  });

  it('writes the credentials to .env with a _DEV suffix for dev, reading the stored ones under the same name', async () => {
    tmp.write('.env', 'STORAGE_KEY_DEV=stored\n');

    const { env } = await sync('dev');

    expect(env).toEqual([{ key: 'STORAGE_KEY', value: 'avatars,documents|stored' }]);
    expect(tmp.read('.env')).toBe('STORAGE_KEY_DEV=avatars,documents|stored\n');
    expect(succeeded()).toContain('STORAGE_KEY_DEV written to .env.');
  });

  it('writes the prod credentials without a suffix', async () => {
    await sync('prod');

    expect(provider.events).toEqual(['create app-avatars-prod public', 'create app-documents-prod private']);
    expect(tmp.read('.env')).toBe('STORAGE_KEY=avatars,documents|none\n');
  });

  it('fails naming the bucket, creating nothing, when an existing bucket has a different access', async () => {
    provider.buckets = [{ name: 'app-documents-dev', access: 'public' }];

    await expect(sync()).rejects.toThrow(
      "The bucket `documents` is declared private, but `app-documents-dev` already exists on vercel as public. A bucket's access cannot change once it exists: declare it public, or delete `app-documents-dev` on vercel and sync again."
    );

    expect(provider.events).toEqual([]);
    expect(tmp.exists('.env')).toBe(false);
  });

  it('warns about buckets of this project and target that are no longer declared, and leaves them in place', async () => {
    provider.buckets = [
      { name: 'app-old-dev', access: 'private' },
      { name: 'app-old-prod', access: 'private' },
      { name: 'other-old-dev', access: 'private' },
    ];

    await sync();

    expect(logged().filter((line) => line.includes('Warning'))).toEqual([
      expect.stringContaining('Warning: `app-old-dev` exists on vercel for dev but storage.ts no longer declares it. It was left in place.'),
    ]);
  });

  it('saves a newly derived project name and a newly chosen account to typebase.json', async () => {
    tmp.write('typebase.json', JSON.stringify({ vercel: { projectId: 'p', projectName: 'My Server', orgId: 'o' } }));
    provider.newAccount = { vercel: { orgId: 'team_acme' } };

    await sync();

    expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ storage: { project: 'my-server', vercel: { orgId: 'team_acme' } } });
    expect(succeeded()).toContain('Saved the storage project "my-server" and vercel account to typebase.json.');
    expect(provider.events).toContain('create my-server-avatars-dev public');
  });

  it('saves only a newly chosen account when the project name is already saved', async () => {
    provider.newAccount = { vercel: { orgId: 'team_acme' } };

    await sync();

    expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ storage: { project: 'app', vercel: { orgId: 'team_acme' } } });
    expect(succeeded()).toContain('Saved the vercel account to typebase.json.');
  });

  it('saves only a newly derived project name when the account is already saved', async () => {
    tmp.write(
      'typebase.json',
      JSON.stringify({ vercel: { projectId: 'p', projectName: 'My Server', orgId: 'o' }, storage: { vercel: { orgId: 'team_acme' } } })
    );

    await sync();

    expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ storage: { project: 'my-server', vercel: { orgId: 'team_acme' } } });
    expect(succeeded()).toContain('Saved the storage project "my-server" to typebase.json.');
  });

  it('leaves typebase.json alone when the project and account are already saved', async () => {
    const before = tmp.read('typebase.json');

    await sync();

    expect(tmp.read('typebase.json')).toBe(before);
  });

  it('hands the declared region to vercel', async () => {
    tmp.write('typebase/storage.ts', storageFile('vercel', '\n  options: { region: "iad1" },'));

    await sync();

    expect(vercel).toHaveBeenCalledWith(expect.objectContaining({ region: 'iad1' }));
  });

  it('hands the declared location hint, project and target to cloudflare', async () => {
    tmp.write('typebase/storage.ts', storageFile('cloudflare', '\n  options: { locationHint: "weur" },'));

    await sync('prod');

    expect(cloudflare).toHaveBeenCalledWith(expect.objectContaining({ locationHint: 'weur', project: 'app', target: 'prod' }));
  });

  it('warns that r2.dev is not production-grade on a cloudflare prod sync with public buckets', async () => {
    tmp.write('typebase/storage.ts', storageFile('cloudflare'));

    await sync('prod');

    expect(logged()).toContainEqual(expect.stringContaining('Warning: public buckets are served from r2.dev'));
    expect(logged()).toContainEqual(expect.stringContaining('app-avatars-prod'));
  });

  it.each([
    { name: 'a cloudflare dev sync', declaredProvider: 'cloudflare', target: 'dev' as const },
    { name: 'a vercel prod sync', declaredProvider: 'vercel', target: 'prod' as const },
  ])('says nothing about r2.dev on $name', async ({ declaredProvider, target }) => {
    tmp.write('typebase/storage.ts', storageFile(declaredProvider));

    await sync(target);

    expect(logged()).not.toContainEqual(expect.stringContaining('r2.dev'));
  });

  it('creates nothing for a filesystem storage and says so', async () => {
    tmp.write('typebase/storage.ts', 'export const storage = defineStorage({ provider: "filesystem", buckets: { avatars: {} } });\n');

    await expect(sync()).resolves.toEqual({ env: [] });

    expect(vercel).not.toHaveBeenCalled();
    expect(cloudflare).not.toHaveBeenCalled();
    expect(logged()).toEqual(['The filesystem storage provider keeps files on disk, so there are no buckets to create for dev.']);
  });

  it('fails when there is no storage file', async () => {
    await expect(
      withCwd(tmp.path, () => syncBuckets({ target: 'dev', storageFilePath: path.join(tmp.path, 'typebase/missing.ts') }))
    ).rejects.toThrow('There is no storage file at `typebase/missing.ts`. Declare your buckets with `defineStorage` there, then sync again.');
  });
});
