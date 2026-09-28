import { createHash } from 'node:crypto';

import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type BucketAccess } from '#helpers/constants.ts';
import { CloudflareClient, type CloudflareTokenPolicy } from '#helpers/deploy/cloudflare/client.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { cloudflare } from '#helpers/storage/cloudflare/index.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const r2 = vi.hoisted(() => ({
  buckets: [] as { name: string; domain: string; enabled: boolean }[],
  tokens: [] as { id: string; name: string; value: string; policies: CloudflareTokenPolicy[] }[],
  events: [] as string[],
}));

vi.mock('#helpers/deploy/cloudflare/get-cloudflare-token.ts', () => ({ getCloudflareToken: vi.fn(() => Promise.resolve('cloudflare-token')) }));

vi.mock('#helpers/deploy/cloudflare/client.ts', () => ({
  CloudflareClient: vi.fn(function () {
    const findBucket = (name: string) => {
      const bucket = r2.buckets.find((candidate) => candidate.name === name);

      if (!bucket) {
        throw new Error(`No bucket ${name}`);
      }

      return bucket;
    };

    return {
      listAccounts: vi.fn(() => Promise.resolve([{ id: 'acc_new', name: 'New' }])),
      listR2Buckets: vi.fn(() => Promise.resolve(r2.buckets.map(({ name }) => name))),
      createR2Bucket: vi.fn(({ name, locationHint }: { name: string; locationHint: string | undefined }) => {
        r2.events.push(`create ${name}${locationHint ? ` ${locationHint}` : ''}`);
        r2.buckets.push({ name, domain: `pub-${name}.r2.dev`, enabled: false });

        return Promise.resolve();
      }),
      getR2ManagedDomain: vi.fn(({ name }: { name: string }) => {
        const { domain, enabled } = findBucket(name);

        return Promise.resolve({ domain, enabled });
      }),
      enableR2ManagedDomain: vi.fn(({ name }: { name: string }) => {
        const bucket = findBucket(name);

        r2.events.push(`enable r2.dev ${name}`);
        bucket.enabled = true;

        return Promise.resolve({ domain: bucket.domain, enabled: true });
      }),
      getPermissionGroupIds: vi.fn(() => Promise.resolve(['pg_write', 'pg_read'])),
      createAccountToken: vi.fn(({ name, policies }: { name: string; policies: CloudflareTokenPolicy[] }) => {
        const token = { id: `tok_${r2.tokens.length + 1}`, name, value: `token-value-${r2.tokens.length + 1}`, policies };

        r2.events.push(`mint ${token.id} ${name}`);
        r2.tokens.push(token);

        return Promise.resolve({ id: token.id, value: token.value });
      }),
      getAccountToken: vi.fn(({ id }: { id: string }) => {
        const token = r2.tokens.find((candidate) => candidate.id === id);

        return Promise.resolve(token ? { id: token.id, name: token.name, policies: token.policies } : undefined);
      }),
      updateAccountToken: vi.fn(({ id, policies }: { id: string; name: string; policies: CloudflareTokenPolicy[] }) => {
        const token = r2.tokens.find((candidate) => candidate.id === id);

        if (!token) {
          throw new Error(`No token ${id}`);
        }

        r2.events.push(`widen ${id}`);
        token.policies = policies;

        return Promise.resolve();
      }),
    };
  }),
}));

const resourceOf = (name: string) => `com.cloudflare.edge.r2.bucket.acc_acme_default_${name}`;

const AVATARS = { bucket: 'avatars', name: 'app-avatars-dev', access: 'public' as BucketAccess };
const DOCUMENTS = { bucket: 'documents', name: 'app-documents-dev', access: 'private' as BucketAccess };

describe('cloudflare storage client', () => {
  let tmp: TempDir;

  const connect = ({
    config = { storage: { cloudflare: { accountId: 'acc_acme' } } },
    locationHint,
  }: { config?: object; locationHint?: string } = {}) => {
    tmp.write('typebase.json', JSON.stringify(config));

    return withCwd(tmp.path, async () => cloudflare({ locationHint, config: await getTypebaseConfig(), project: 'app', target: 'dev' }));
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();

    r2.buckets = [];
    r2.tokens = [];
    r2.events = [];
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('works against the saved account with the CLI token, and reports no new account', async () => {
    const { newAccount } = await connect();

    expect(CloudflareClient).toHaveBeenCalledWith({ token: 'cloudflare-token', accountId: 'acc_acme' });
    expect(newAccount).toBeUndefined();
  });

  it('reports the account it asked for, so it can be saved', async () => {
    vi.mocked(select).mockResolvedValue('acc_new');

    const { newAccount } = await connect({ config: {} });

    expect(newAccount).toEqual({ cloudflare: { accountId: 'acc_new' } });
  });

  it('lists only the buckets of this project and target, public when r2.dev serves them', async () => {
    r2.buckets = [
      { name: 'app-avatars-dev', domain: 'pub-a.r2.dev', enabled: true },
      { name: 'app-documents-dev', domain: 'pub-d.r2.dev', enabled: false },
      { name: 'app-avatars-prod', domain: 'pub-p.r2.dev', enabled: true },
      { name: 'other-avatars-dev', domain: 'pub-o.r2.dev', enabled: true },
    ];

    const { client } = await connect();

    await expect(client.listBuckets()).resolves.toEqual([
      { name: 'app-avatars-dev', access: 'public' },
      { name: 'app-documents-dev', access: 'private' },
    ]);
  });

  it('creates a bucket with the declared location hint, turning on r2.dev only for a public one', async () => {
    const { client } = await connect({ locationHint: 'weur' });

    await client.createBucket({ name: 'app-avatars-dev', access: 'public' });
    await client.createBucket({ name: 'app-documents-dev', access: 'private' });

    expect(r2.events).toEqual(['create app-avatars-dev weur', 'enable r2.dev app-avatars-dev', 'create app-documents-dev weur']);
  });

  it('mints one token scoped to the buckets and gives the R2 keys, the bucket map and each public URL', async () => {
    const { client } = await connect();

    await client.createBucket(AVATARS);
    await client.createBucket(DOCUMENTS);

    const env = await client.getCredentials([AVATARS, DOCUMENTS], () => undefined);

    expect(r2.events.at(-1)).toBe('mint tok_1 typebase-storage-app-dev');
    expect(r2.tokens[0]?.policies).toEqual([
      {
        effect: 'allow',
        permission_groups: [{ id: 'pg_write' }, { id: 'pg_read' }],
        resources: { [resourceOf('app-avatars-dev')]: '*', [resourceOf('app-documents-dev')]: '*' },
      },
    ]);
    expect(env).toEqual([
      { key: 'TYPEBASE_STORAGE_R2_ACCOUNT_ID', value: 'acc_acme' },
      { key: 'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID', value: 'tok_1' },
      { key: 'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY', value: createHash('sha256').update('token-value-1').digest('hex') },
      { key: 'TYPEBASE_STORAGE_R2_BUCKETS', value: JSON.stringify({ avatars: 'app-avatars-dev', documents: 'app-documents-dev' }) },
      { key: 'TYPEBASE_STORAGE_R2_PUBLIC_URL_AVATARS', value: 'https://pub-app-avatars-dev.r2.dev' },
    ]);
  });

  it('keeps the stored keys and leaves the token alone when it already covers the buckets', async () => {
    r2.tokens = [
      {
        id: 'tok_saved',
        name: 'saved',
        value: 'v',
        policies: [{ effect: 'allow', permission_groups: [], resources: { [resourceOf('app-documents-dev')]: '*' } }],
      },
    ];

    const { client } = await connect();
    const stored = { TYPEBASE_STORAGE_R2_ACCESS_KEY_ID: 'tok_saved', TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY: 'stored-secret' } as Record<
      string,
      string
    >;

    const env = await client.getCredentials([DOCUMENTS], (key) => stored[key]);

    expect(r2.events).toEqual([]);
    expect(env.slice(1, 3)).toEqual([
      { key: 'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID', value: 'tok_saved' },
      { key: 'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY', value: 'stored-secret' },
    ]);
  });

  it('widens the stored token in place when the buckets change, keeping the same keys', async () => {
    r2.tokens = [
      {
        id: 'tok_saved',
        name: 'saved',
        value: 'v',
        policies: [{ effect: 'allow', permission_groups: [], resources: { [resourceOf('app-documents-dev')]: '*' } }],
      },
    ];

    const { client } = await connect();
    const stored = { TYPEBASE_STORAGE_R2_ACCESS_KEY_ID: 'tok_saved', TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY: 'stored-secret' } as Record<
      string,
      string
    >;

    await client.createBucket(AVATARS);

    const env = await client.getCredentials([AVATARS, DOCUMENTS], (key) => stored[key]);

    expect(r2.events.at(-1)).toBe('widen tok_saved');
    expect(Object.keys(r2.tokens[0]?.policies[0]?.resources ?? {})).toEqual([resourceOf('app-avatars-dev'), resourceOf('app-documents-dev')]);
    expect(env.slice(1, 3)).toEqual([
      { key: 'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID', value: 'tok_saved' },
      { key: 'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY', value: 'stored-secret' },
    ]);
  });

  it.each<{ name: string; stored: Record<string, string> }>([
    {
      name: 'the stored token no longer exists on Cloudflare',
      stored: { TYPEBASE_STORAGE_R2_ACCESS_KEY_ID: 'tok_gone', TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY: 's' },
    },
    { name: 'there is no stored secret', stored: { TYPEBASE_STORAGE_R2_ACCESS_KEY_ID: 'tok_1' } },
  ])('mints a new token when $name', async ({ stored }) => {
    r2.tokens = [{ id: 'tok_1', name: 'saved', value: 'v', policies: [] }];

    const { client } = await connect();

    await client.getCredentials([DOCUMENTS], (key) => stored[key]);

    expect(r2.events).toEqual(['mint tok_2 typebase-storage-app-dev']);
  });

  it('fails naming the bucket when a public bucket has no r2.dev domain', async () => {
    r2.buckets = [{ name: 'app-avatars-dev', domain: 'pub-a.r2.dev', enabled: false }];

    const { client } = await connect();

    await client.listBuckets();

    await expect(client.getCredentials([AVATARS], () => undefined)).rejects.toThrow(
      'The R2 bucket `app-avatars-dev` for the public bucket `avatars` has no r2.dev domain on Cloudflare.'
    );
  });
});
