import fs from 'node:fs';
import path from 'node:path';

import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { storage } from '#commands/storage.ts';

import { type BucketAccess } from '#helpers/constants.ts';
import { CloudflareClient, type CloudflareTokenPolicy } from '#helpers/deploy/cloudflare/client.ts';
import { VercelClient } from '#helpers/deploy/vercel/client.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const vercelStorage = vi.hoisted(() => ({
  stores: [] as { id: string; name: string; access: BucketAccess }[],
  events: [] as string[],
  teams: [
    { id: 'team_acme', name: 'Acme', slug: 'acme' },
    { id: 'team_beta', name: 'Beta', slug: 'beta' },
  ],
}));

vi.mock('#helpers/deploy/vercel/client.ts', () => ({
  VercelClient: vi.fn(function () {
    return {
      listTeams: vi.fn(() => Promise.resolve(vercelStorage.teams)),
      listStores: vi.fn(() => Promise.resolve([...vercelStorage.stores])),
      createStore: vi.fn(({ name, access, region }: { name: string; access: BucketAccess; region: string | undefined }) => {
        const store = { id: `store_${name}`, name, access };

        vercelStorage.events.push(`create ${name} ${access}${region ? ` ${region}` : ''}`);
        vercelStorage.stores.push(store);

        return Promise.resolve(store);
      }),
      getStoreToken: vi.fn(({ id }: { id: string }) => Promise.resolve(`vercel_blob_rw_${id}`)),
    };
  }),
}));

const cloudflareStorage = vi.hoisted(() => ({
  buckets: [] as { name: string; domain: string; enabled: boolean }[],
  tokens: [] as { id: string; name: string; value: string; policies: CloudflareTokenPolicy[] }[],
  events: [] as string[],
  accounts: [
    { id: 'acc_acme', name: 'Acme' },
    { id: 'acc_beta', name: 'Beta' },
  ],
}));

vi.mock('#helpers/deploy/cloudflare/client.ts', () => ({
  CloudflareClient: vi.fn(function () {
    const bucketsOf = (policies: CloudflareTokenPolicy[]) =>
      policies
        .flatMap(({ resources }) => Object.keys(resources))
        .map((resource) => resource.replace('com.cloudflare.edge.r2.bucket.acc_acme_default_', ''))
        .join(',');

    const findBucket = (name: string) => {
      const bucket = cloudflareStorage.buckets.find((candidate) => candidate.name === name);

      if (!bucket) {
        throw new Error(`No bucket ${name}`);
      }

      return bucket;
    };

    return {
      listAccounts: vi.fn(() => Promise.resolve(cloudflareStorage.accounts)),
      listR2Buckets: vi.fn(() => Promise.resolve(cloudflareStorage.buckets.map(({ name }) => name))),
      createR2Bucket: vi.fn(({ name, locationHint }: { name: string; locationHint: string | undefined }) => {
        cloudflareStorage.events.push(`create ${name}${locationHint ? ` ${locationHint}` : ''}`);
        cloudflareStorage.buckets.push({ name, domain: `pub-${name}.r2.dev`, enabled: false });

        return Promise.resolve();
      }),
      getR2ManagedDomain: vi.fn(({ name }: { name: string }) => {
        const { domain, enabled } = findBucket(name);

        return Promise.resolve({ domain, enabled });
      }),
      enableR2ManagedDomain: vi.fn(({ name }: { name: string }) => {
        const bucket = findBucket(name);

        cloudflareStorage.events.push(`enable r2.dev ${name}`);
        bucket.enabled = true;

        return Promise.resolve({ domain: bucket.domain, enabled: true });
      }),
      getPermissionGroupIds: vi.fn((names: string[]) =>
        Promise.resolve(
          names.map((name) => ({ 'Workers R2 Storage Bucket Item Write': 'pg_write', 'Workers R2 Storage Bucket Item Read': 'pg_read' })[name])
        )
      ),
      createAccountToken: vi.fn(({ name, policies }: { name: string; policies: CloudflareTokenPolicy[] }) => {
        const token = {
          id: `tok_${cloudflareStorage.tokens.length + 1}`,
          name,
          value: `token-value-${cloudflareStorage.tokens.length + 1}`,
          policies,
        };

        cloudflareStorage.events.push(`mint ${token.id} ${name} ${bucketsOf(policies)}`);
        cloudflareStorage.tokens.push(token);

        return Promise.resolve({ id: token.id, value: token.value });
      }),
      getAccountToken: vi.fn(({ id }: { id: string }) => {
        const token = cloudflareStorage.tokens.find((candidate) => candidate.id === id);

        return Promise.resolve(token ? { id: token.id, name: token.name, policies: token.policies } : undefined);
      }),
      updateAccountToken: vi.fn(({ id, name, policies }: { id: string; name: string; policies: CloudflareTokenPolicy[] }) => {
        const token = cloudflareStorage.tokens.find((candidate) => candidate.id === id);

        if (!token) {
          throw new Error(`No token ${id}`);
        }

        cloudflareStorage.events.push(`widen ${id} ${name} ${bucketsOf(policies)}`);
        token.policies = policies;

        return Promise.resolve();
      }),
    };
  }),
}));

const VERCEL_STORAGE_FILE = `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'vercel',
  buckets: {
    avatars: { access: 'public' },
    documents: { access: 'private' },
  },
});
`;

const ENV_FILE = 'VERCEL_TOKEN=cli-token\n';

describe('storage sync command', () => {
  let tmp: TempDir;

  const sync = (target: 'dev' | 'prod') => withCwd(tmp.path, () => storage.parseAsync(['sync', target], { from: 'user' }));

  const output = () => vercelStorage.events.filter((event) => event.startsWith('log ')).map((event) => event.slice(4));

  beforeEach(() => {
    vi.clearAllMocks();

    delete process.env.VERCEL_TOKEN;

    tmp = createTempDir();

    vercelStorage.stores = [];
    vercelStorage.events = [];

    tmp.write('package.json', JSON.stringify({ name: '@acme/My_App' }));
    tmp.write('typebase/storage.ts', VERCEL_STORAGE_FILE);
    tmp.write('.env', ENV_FILE);

    vi.mocked(select).mockResolvedValue('team_acme');

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      vercelStorage.events.push(`log ${String(line)}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('freezes the project name, saves the team, creates the declared buckets and writes their tokens on the first sync', async () => {
    await sync('dev');

    expect(tmp.read('typebase.json')).toEqualTemplate('storage-sync', 'first-sync', 'typebase.json.txt');
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'first-sync', 'env-dev.txt');

    expect(vercelStorage.events).toEqual([
      'log Buckets to create for dev:\n  acme-my-app-avatars-dev (public)\n  acme-my-app-documents-dev (private)',
      'create acme-my-app-avatars-dev public',
      'create acme-my-app-documents-dev private',
    ]);

    expect(select).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledWith({
      message: 'Select the Vercel team that holds your Blob stores:',
      choices: [
        { name: 'Acme (acme)', value: 'team_acme' },
        { name: 'Beta (beta)', value: 'team_beta' },
      ],
    });
  });

  it('authenticates with the CLI Vercel token against the saved team, and never writes that token anywhere new', async () => {
    await sync('dev');

    expect(VercelClient).toHaveBeenCalledWith({ token: 'cli-token', orgId: undefined });
    expect(VercelClient).toHaveBeenLastCalledWith({ token: 'cli-token', orgId: 'team_acme' });
    expect(tmp.read('typebase.json')).toEqualTemplate('storage-sync', 'first-sync', 'typebase.json.txt');
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'first-sync', 'env-dev.txt');
  });

  it('changes nothing when run again', async () => {
    await sync('dev');

    const typebaseJson = tmp.read('typebase.json');
    const envFile = tmp.read('.env');

    vercelStorage.events = [];

    await sync('dev');

    expect(tmp.read('typebase.json')).toBe(typebaseJson);
    expect(tmp.read('.env')).toBe(envFile);
    expect(vercelStorage.events).toEqual(['log All buckets for dev already exist.']);
    expect(select).toHaveBeenCalledOnce();
  });

  it('writes the prod tokens without a suffix', async () => {
    await sync('prod');

    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'first-sync', 'env-prod.txt');
    expect(vercelStorage.events).toEqual([
      'log Buckets to create for prod:\n  acme-my-app-avatars-prod (public)\n  acme-my-app-documents-prod (private)',
      'create acme-my-app-avatars-prod public',
      'create acme-my-app-documents-prod private',
    ]);
  });

  describe('derives the project name from the server config before the package name', () => {
    it.each([
      { provider: 'vercel', server: { vercel: { projectId: 'prj_1', projectName: 'My Server' } }, project: 'my-server' },
      {
        provider: 'cloudflare',
        server: { cloudflare: { accountId: 'acc_1', workerName: 'edge_worker', subdomain: 'acme' } },
        project: 'edge-worker',
      },
      { provider: 'deno', server: { deno: { org: 'org_1', projectId: 'prj_1', slug: 'deno-slug' } }, project: 'deno-slug' },
    ])('from the $provider server config', async ({ provider, server, project }) => {
      tmp.write('typebase.json', `${JSON.stringify(server, null, 2)}\n`);

      await sync('dev');

      expect(tmp.read('typebase.json')).toEqualTemplate('storage-sync', 'server-project', `${provider}.json.txt`);
      expect(vercelStorage.stores.map(({ name }) => name)).toEqual([`${project}-avatars-dev`, `${project}-documents-dev`]);
    });
  });

  it('reads the frozen project name instead of deriving it again', async () => {
    tmp.write('typebase.json', `${JSON.stringify({ storage: { project: 'frozen', vercel: { orgId: 'team_beta' } } }, null, 2)}\n`);
    tmp.write('package.json', JSON.stringify({ name: 'renamed-app' }));

    await sync('dev');

    expect(tmp.read('typebase.json')).toEqualTemplate('storage-sync', 'frozen-project', 'typebase.json.txt');
    expect(vercelStorage.stores.map(({ name }) => name)).toEqual(['frozen-avatars-dev', 'frozen-documents-dev']);
    expect(VercelClient).toHaveBeenCalledWith({ token: 'cli-token', orgId: 'team_beta' });
    expect(select).not.toHaveBeenCalled();
  });

  it('adopts existing buckets silently and creates only the missing ones', async () => {
    vercelStorage.stores = [{ id: 'store_existing', name: 'acme-my-app-avatars-dev', access: 'public' }];

    await sync('dev');

    expect(vercelStorage.events).toEqual([
      'log Buckets to create for dev:\n  acme-my-app-documents-dev (private)',
      'create acme-my-app-documents-dev private',
    ]);
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'adopted', 'env-dev.txt');
  });

  it('fails naming the bucket, and changes nothing, when an existing bucket has a different access', async () => {
    vercelStorage.stores = [{ id: 'store_existing', name: 'acme-my-app-avatars-dev', access: 'private' }];

    await expect(sync('dev')).rejects.toThrow(
      "The bucket `avatars` is declared public, but `acme-my-app-avatars-dev` already exists on vercel as private. A bucket's access cannot change once it exists: declare it private, or delete `acme-my-app-avatars-dev` on vercel and sync again."
    );

    expect(vercelStorage.events).toEqual([]);
    expect(tmp.exists('typebase.json')).toBe(false);
    expect(tmp.read('.env')).toBe(ENV_FILE);
  });

  it('fails naming the bucket, and changes nothing, when a bucket declares no access', async () => {
    tmp.write(
      'typebase/storage.ts',
      `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'vercel',
  buckets: { avatars: { access: 'public' }, documents: {} },
});
`
    );

    await expect(sync('dev')).rejects.toThrow(
      "The bucket `documents` in `storage.ts` has no access. Declare it `access: 'public'` or `access: 'private'`."
    );

    expect(vercelStorage.events).toEqual([]);
    expect(tmp.exists('typebase.json')).toBe(false);
    expect(tmp.read('.env')).toBe(ENV_FILE);
  });

  it('leaves a frozen project and saved team untouched when an existing bucket has a different access', async () => {
    tmp.write('typebase.json', `${JSON.stringify({ storage: { project: 'frozen', vercel: { orgId: 'team_beta' } } }, null, 2)}\n`);
    vercelStorage.stores = [{ id: 'store_existing', name: 'frozen-documents-dev', access: 'public' }];

    await expect(sync('dev')).rejects.toThrow('The bucket `documents` is declared private');

    expect(tmp.read('typebase.json')).toEqualTemplate('storage-sync', 'frozen-project', 'typebase.json.txt');
    expect(tmp.read('.env')).toBe(ENV_FILE);
  });

  it('warns about orphan buckets of this project and target and leaves them in place', async () => {
    vercelStorage.stores = [
      { id: 'store_old', name: 'acme-my-app-old-dev', access: 'private' },
      { id: 'store_prod', name: 'acme-my-app-old-prod', access: 'private' },
      { id: 'store_other', name: 'other-avatars-dev', access: 'public' },
    ];

    await sync('dev');

    expect(output()).toEqual([
      'Buckets to create for dev:\n  acme-my-app-avatars-dev (public)\n  acme-my-app-documents-dev (private)',
      'Warning: `acme-my-app-old-dev` exists on vercel for dev but storage.ts no longer declares it. It was left in place.',
    ]);
    expect(vercelStorage.stores.map(({ name }) => name)).toEqual([
      'acme-my-app-old-dev',
      'acme-my-app-old-prod',
      'other-avatars-dev',
      'acme-my-app-avatars-dev',
      'acme-my-app-documents-dev',
    ]);
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'first-sync', 'env-dev.txt');
  });

  it('creates buckets in the declared region', async () => {
    tmp.write(
      'typebase/storage.ts',
      `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'vercel',
  options: { region: 'fra1' },
  buckets: { avatars: { access: 'public' } },
});
`
    );

    await sync('dev');

    expect(vercelStorage.events).toEqual([
      'log Buckets to create for dev:\n  acme-my-app-avatars-dev (public)',
      'create acme-my-app-avatars-dev public fra1',
    ]);
  });

  it('creates nothing with the filesystem provider and says so', async () => {
    tmp.write(
      'typebase/storage.ts',
      `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'filesystem',
  buckets: { avatars: {} },
});
`
    );

    await sync('dev');

    expect(output()).toEqual(['The filesystem storage provider keeps files on disk, so there are no buckets to create for dev.']);
    expect(VercelClient).not.toHaveBeenCalled();
    expect(tmp.exists('typebase.json')).toBe(false);
    expect(tmp.read('.env')).toBe(ENV_FILE);
  });

  it('refuses a target other than dev or prod, before touching anything', async () => {
    const [syncCommand] = storage.commands;

    syncCommand?.exitOverride().configureOutput({ writeErr: () => undefined });

    await expect(withCwd(tmp.path, () => storage.parseAsync(['sync', 'staging'], { from: 'user' }))).rejects.toThrow(
      'Target must be "dev" or "prod".'
    );

    expect(vercelStorage.events).toEqual([]);
    expect(tmp.exists('typebase.json')).toBe(false);
  });

  it('fails when the project has no storage file', async () => {
    fs.rmSync(path.join(tmp.path, 'typebase/storage.ts'));

    await expect(sync('dev')).rejects.toThrow(
      'There is no storage file at `typebase/storage.ts`. Declare your buckets with `defineStorage` there, then sync again.'
    );
  });

  it('fails when the project name cannot be derived from anything', async () => {
    tmp.write('package.json', JSON.stringify({}));

    await expect(sync('dev')).rejects.toThrow(
      'Could not choose a storage project name: there is no server config and `package.json` has no usable `name`. Set `storage.project` in typebase.json and sync again.'
    );
  });
});

const CLOUDFLARE_STORAGE_FILE = `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'cloudflare',
  buckets: {
    avatars: { access: 'public' },
    documents: { access: 'private' },
  },
});
`;

const CLOUDFLARE_ENV_FILE = 'CLOUDFLARE_API_TOKEN=cf-token\n';

describe('storage sync command with the cloudflare provider', () => {
  let tmp: TempDir;

  const sync = (target: 'dev' | 'prod') => withCwd(tmp.path, () => storage.parseAsync(['sync', target], { from: 'user' }));

  const output = () => cloudflareStorage.events.filter((event) => event.startsWith('log ')).map((event) => event.slice(4));

  const policyFor = (...names: string[]): CloudflareTokenPolicy[] => [
    {
      effect: 'allow',
      permission_groups: [{ id: 'pg_write' }, { id: 'pg_read' }],
      resources: Object.fromEntries(names.map((name) => [`com.cloudflare.edge.r2.bucket.acc_acme_default_${name}`, '*'])),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    delete process.env.CLOUDFLARE_API_TOKEN;

    tmp = createTempDir();

    cloudflareStorage.buckets = [];
    cloudflareStorage.tokens = [];
    cloudflareStorage.events = [];

    tmp.write('package.json', JSON.stringify({ name: '@acme/My_App' }));
    tmp.write('typebase/storage.ts', CLOUDFLARE_STORAGE_FILE);
    tmp.write('.env', CLOUDFLARE_ENV_FILE);

    vi.mocked(select).mockResolvedValue('acc_acme');

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      cloudflareStorage.events.push(`log ${String(line)}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('saves the account, creates the buckets, enables r2.dev on public ones and mints one R2 token for them on the first sync', async () => {
    await sync('dev');

    expect(tmp.read('typebase.json')).toEqualTemplate('storage-sync', 'cloudflare', 'first-sync', 'typebase.json.txt');
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'first-sync', 'env-dev.txt');

    expect(cloudflareStorage.events).toEqual([
      'log Buckets to create for dev:\n  acme-my-app-avatars-dev (public)\n  acme-my-app-documents-dev (private)',
      'create acme-my-app-avatars-dev',
      'enable r2.dev acme-my-app-avatars-dev',
      'create acme-my-app-documents-dev',
      'mint tok_1 typebase-storage-acme-my-app-dev acme-my-app-avatars-dev,acme-my-app-documents-dev',
    ]);
    expect(cloudflareStorage.tokens.map(({ policies }) => policies)).toEqual([policyFor('acme-my-app-avatars-dev', 'acme-my-app-documents-dev')]);

    expect(select).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledWith({
      message: 'Select the Cloudflare account that holds your R2 buckets:',
      choices: [
        { name: 'Acme', value: 'acc_acme' },
        { name: 'Beta', value: 'acc_beta' },
      ],
    });
  });

  it('authenticates with the CLI Cloudflare token against the saved account, and never writes that token anywhere new', async () => {
    await sync('dev');

    expect(CloudflareClient).toHaveBeenCalledWith({ token: 'cf-token', accountId: undefined });
    expect(CloudflareClient).toHaveBeenLastCalledWith({ token: 'cf-token', accountId: 'acc_acme' });
    expect(tmp.read('typebase.json')).toEqualTemplate('storage-sync', 'cloudflare', 'first-sync', 'typebase.json.txt');
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'first-sync', 'env-dev.txt');
  });

  it('reads the saved account instead of asking again', async () => {
    tmp.write('typebase.json', `${JSON.stringify({ storage: { project: 'acme-my-app', cloudflare: { accountId: 'acc_acme' } } }, null, 2)}\n`);

    await sync('dev');

    expect(select).not.toHaveBeenCalled();
    expect(CloudflareClient).toHaveBeenCalledWith({ token: 'cf-token', accountId: 'acc_acme' });
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'first-sync', 'env-dev.txt');
  });

  it('changes nothing when run again', async () => {
    await sync('dev');

    const typebaseJson = tmp.read('typebase.json');
    const envFile = tmp.read('.env');

    cloudflareStorage.events = [];

    await sync('dev');

    expect(tmp.read('typebase.json')).toBe(typebaseJson);
    expect(tmp.read('.env')).toBe(envFile);
    expect(cloudflareStorage.events).toEqual(['log All buckets for dev already exist.']);
    expect(cloudflareStorage.tokens).toHaveLength(1);
    expect(select).toHaveBeenCalledOnce();
  });

  it('widens the same token in place when a bucket is added, so the keys never change', async () => {
    await sync('dev');

    cloudflareStorage.events = [];

    tmp.write(
      'typebase/storage.ts',
      `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'cloudflare',
  buckets: {
    avatars: { access: 'public' },
    documents: { access: 'private' },
    'user-banners': { access: 'public' },
  },
});
`
    );

    await sync('dev');

    expect(cloudflareStorage.events).toEqual([
      'log Buckets to create for dev:\n  acme-my-app-user-banners-dev (public)',
      'create acme-my-app-user-banners-dev',
      'enable r2.dev acme-my-app-user-banners-dev',
      'widen tok_1 typebase-storage-acme-my-app-dev acme-my-app-avatars-dev,acme-my-app-documents-dev,acme-my-app-user-banners-dev',
    ]);
    expect(cloudflareStorage.tokens).toHaveLength(1);
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'widened', 'env-dev.txt');
  });

  it('mints a new token when the saved one no longer exists on Cloudflare', async () => {
    await sync('dev');

    cloudflareStorage.tokens = [];
    cloudflareStorage.events = [];

    await sync('dev');

    expect(cloudflareStorage.events).toEqual([
      'log All buckets for dev already exist.',
      'mint tok_1 typebase-storage-acme-my-app-dev acme-my-app-avatars-dev,acme-my-app-documents-dev',
    ]);
  });

  it('mints a new token when the local env file has no secret for the saved one', async () => {
    tmp.write('.env', `${CLOUDFLARE_ENV_FILE}TYPEBASE_STORAGE_R2_ACCESS_KEY_ID_DEV=tok_1\n`);
    cloudflareStorage.tokens = [{ id: 'tok_1', name: 'typebase-storage-acme-my-app-dev', value: 'lost', policies: [] }];

    await sync('dev');

    expect(cloudflareStorage.events.filter((event) => !event.startsWith('log ')).at(-1)).toBe(
      'mint tok_2 typebase-storage-acme-my-app-dev acme-my-app-avatars-dev,acme-my-app-documents-dev'
    );
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'reminted', 'env-dev.txt');
  });

  it('writes the prod keys without a suffix and warns that r2.dev is not production-grade', async () => {
    await sync('prod');

    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'first-sync', 'env-prod.txt');
    expect(output()).toEqual([
      'Buckets to create for prod:\n  acme-my-app-avatars-prod (public)\n  acme-my-app-documents-prod (private)',
      'Warning: public buckets are served from r2.dev, which is rate-limited and not meant for production. Connect a custom domain to acme-my-app-avatars-prod in the Cloudflare dashboard before you rely on it.',
    ]);
  });

  it('does not warn about r2.dev on a dev sync or a prod sync without public buckets', async () => {
    tmp.write(
      'typebase/storage.ts',
      `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'cloudflare',
  buckets: { documents: { access: 'private' } },
});
`
    );

    await sync('prod');

    expect(output()).toEqual(['Buckets to create for prod:\n  acme-my-app-documents-prod (private)']);
  });

  it('adopts existing buckets silently and creates only the missing ones', async () => {
    cloudflareStorage.buckets = [{ name: 'acme-my-app-avatars-dev', domain: 'pub-existing.r2.dev', enabled: true }];

    await sync('dev');

    expect(cloudflareStorage.events).toEqual([
      'log Buckets to create for dev:\n  acme-my-app-documents-dev (private)',
      'create acme-my-app-documents-dev',
      'mint tok_1 typebase-storage-acme-my-app-dev acme-my-app-avatars-dev,acme-my-app-documents-dev',
    ]);
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'adopted', 'env-dev.txt');
  });

  it('fails naming the bucket, and changes nothing, when an existing bucket has a different access', async () => {
    cloudflareStorage.buckets = [{ name: 'acme-my-app-avatars-dev', domain: 'pub-existing.r2.dev', enabled: false }];

    await expect(sync('dev')).rejects.toThrow(
      "The bucket `avatars` is declared public, but `acme-my-app-avatars-dev` already exists on cloudflare as private. A bucket's access cannot change once it exists: declare it private, or delete `acme-my-app-avatars-dev` on cloudflare and sync again."
    );

    expect(cloudflareStorage.events).toEqual([]);
    expect(cloudflareStorage.tokens).toEqual([]);
    expect(tmp.exists('typebase.json')).toBe(false);
    expect(tmp.read('.env')).toBe(CLOUDFLARE_ENV_FILE);
  });

  it('warns about orphan buckets of this project and target, leaves them in place and keeps them out of the token', async () => {
    cloudflareStorage.buckets = [
      { name: 'acme-my-app-old-dev', domain: 'pub-old.r2.dev', enabled: false },
      { name: 'acme-my-app-old-prod', domain: 'pub-old-prod.r2.dev', enabled: false },
      { name: 'other-avatars-dev', domain: 'pub-other.r2.dev', enabled: true },
    ];

    await sync('dev');

    expect(output()).toEqual([
      'Buckets to create for dev:\n  acme-my-app-avatars-dev (public)\n  acme-my-app-documents-dev (private)',
      'Warning: `acme-my-app-old-dev` exists on cloudflare for dev but storage.ts no longer declares it. It was left in place.',
    ]);
    expect(cloudflareStorage.buckets.map(({ name }) => name)).toEqual([
      'acme-my-app-old-dev',
      'acme-my-app-old-prod',
      'other-avatars-dev',
      'acme-my-app-avatars-dev',
      'acme-my-app-documents-dev',
    ]);
    expect(cloudflareStorage.tokens.map(({ policies }) => policies)).toEqual([policyFor('acme-my-app-avatars-dev', 'acme-my-app-documents-dev')]);
    expect(tmp.read('.env')).toEqualTemplate('storage-sync', 'cloudflare', 'first-sync', 'env-dev.txt');
  });

  it('creates buckets with the declared location hint', async () => {
    tmp.write(
      'typebase/storage.ts',
      `import { defineStorage } from 'typebase-io/server';

export const storage = defineStorage({
  provider: 'cloudflare',
  options: { locationHint: 'weur' },
  buckets: { documents: { access: 'private' } },
});
`
    );

    await sync('dev');

    expect(cloudflareStorage.events.filter((event) => event.startsWith('create '))).toEqual(['create acme-my-app-documents-dev weur']);
  });
});
