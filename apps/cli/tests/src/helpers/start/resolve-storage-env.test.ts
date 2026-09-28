import path from 'node:path';

import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveStorageEnv } from '#helpers/start/resolve-storage-env.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('resolveStorageEnv', () => {
  let tmp: TempDir;

  const declare = (provider: string) => {
    tmp.write(
      'typebase/storage.ts',
      `export const storage = defineStorage({ provider: "${provider}", buckets: { avatars: { access: "public" }, documents: { access: "private" } } });\n`
    );
  };

  const resolve = (choice: { devStorage?: boolean; prodStorage?: boolean }) =>
    withCwd(tmp.path, () =>
      resolveStorageEnv({
        devStorage: choice.devStorage,
        prodStorage: choice.prodStorage,
        storageFilePath: path.join(tmp.path, 'typebase/storage.ts'),
      })
    );

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('chooses no real buckets when neither flag is given', async () => {
    declare('vercel');
    tmp.write('.env', 'TYPEBASE_STORAGE_VERCEL_TOKENS_DEV={"avatars":"dev"}\n');

    await expect(resolve({})).resolves.toBeUndefined();
  });

  it('reads the dev Blob store tokens for the dev buckets', async () => {
    declare('vercel');
    tmp.write('.env', 'TYPEBASE_STORAGE_VERCEL_TOKENS_DEV={"avatars":"dev"}\nTYPEBASE_STORAGE_VERCEL_TOKENS={"avatars":"prod"}\n');

    await expect(resolve({ devStorage: true })).resolves.toEqual({
      target: 'dev',
      source: 'TYPEBASE_STORAGE_VERCEL_TOKENS_DEV',
      env: [{ key: 'TYPEBASE_STORAGE_VERCEL_TOKENS', value: '{"avatars":"dev"}' }],
    });
  });

  it('reads the production Blob store tokens, unsuffixed, for the production buckets', async () => {
    declare('vercel');
    tmp.write('.env', 'TYPEBASE_STORAGE_VERCEL_TOKENS_DEV={"avatars":"dev"}\nTYPEBASE_STORAGE_VERCEL_TOKENS={"avatars":"prod"}\n');

    await expect(resolve({ prodStorage: true })).resolves.toEqual({
      target: 'prod',
      source: 'TYPEBASE_STORAGE_VERCEL_TOKENS',
      env: [{ key: 'TYPEBASE_STORAGE_VERCEL_TOKENS', value: '{"avatars":"prod"}' }],
    });
  });

  it('reads every R2 key and the public URL of each public bucket for a cloudflare storage', async () => {
    declare('cloudflare');
    tmp.write(
      '.env',
      [
        'TYPEBASE_STORAGE_R2_ACCOUNT_ID_DEV=acc',
        'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID_DEV=key',
        'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY_DEV=secret',
        'TYPEBASE_STORAGE_R2_BUCKETS_DEV={"avatars":"app-avatars-dev"}',
        'TYPEBASE_STORAGE_R2_PUBLIC_URL_AVATARS_DEV=https://pub.r2.dev',
      ].join('\n') + '\n'
    );

    await expect(resolve({ devStorage: true })).resolves.toEqual({
      target: 'dev',
      source: 'TYPEBASE_STORAGE_R2_*_DEV',
      env: [
        { key: 'TYPEBASE_STORAGE_R2_ACCOUNT_ID', value: 'acc' },
        { key: 'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID', value: 'key' },
        { key: 'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY', value: 'secret' },
        { key: 'TYPEBASE_STORAGE_R2_BUCKETS', value: '{"avatars":"app-avatars-dev"}' },
        { key: 'TYPEBASE_STORAGE_R2_PUBLIC_URL_AVATARS', value: 'https://pub.r2.dev' },
      ],
    });
  });

  it.each([
    { target: 'dev', choice: { devStorage: true }, key: 'TYPEBASE_STORAGE_VERCEL_TOKENS_DEV' },
    { target: 'prod', choice: { prodStorage: true }, key: 'TYPEBASE_STORAGE_VERCEL_TOKENS' },
  ])('fails pointing at storage sync when the $target keys are missing', async ({ target, choice, key }) => {
    declare('vercel');

    await expect(resolve(choice)).rejects.toThrow(
      `No storage keys found in ${key}. Run \`npx typebase-io-cli storage sync ${target}\` to create the ${target} buckets and write their keys to .env.`
    );
  });

  it('says the flag has no effect on a filesystem storage, which keeps its files where it says', async () => {
    declare('filesystem');

    await expect(resolve({ prodStorage: true })).resolves.toBeUndefined();

    expect(vi.mocked(ora()).warn.mock.calls.flat()).toContain(
      '`--prod-storage` has no effect: `storage.ts` declares the `filesystem` provider, which keeps its files where it says.'
    );
  });

  it('chooses nothing for a project without storage', async () => {
    await expect(resolve({ devStorage: true })).resolves.toBeUndefined();
  });
});
