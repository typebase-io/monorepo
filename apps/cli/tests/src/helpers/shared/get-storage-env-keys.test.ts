import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getStorageEnvKeys } from '#helpers/shared/get-storage-env-keys.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getStorageEnvKeys', () => {
  let tmp: TempDir;

  const LOCAL_STORAGE = { root: '/cache/.local-storage', url: 'http://localhost:8080/storage' };

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const keysFor = (provider: Parameters<typeof getStorageEnvKeys>[0]['provider'], localStorage?: typeof LOCAL_STORAGE) => {
    tmp.write(
      'storage.ts',
      `export const storage = defineStorage({ provider: "${String(provider)}", buckets: { avatars: { access: "public" }, "user-files": { access: "public" }, invoices: { access: "private" } } });\n`
    );

    return getStorageEnvKeys({ provider, localStorage, storageFilePath: path.join(tmp.path, 'storage.ts') });
  };

  it('needs the Blob store tokens for a vercel storage', () => {
    expect(keysFor('vercel')).toEqual(['TYPEBASE_STORAGE_VERCEL_TOKENS']);
  });

  it('needs the R2 keys and one public URL per public bucket for a cloudflare storage', () => {
    expect(keysFor('cloudflare')).toEqual([
      'TYPEBASE_STORAGE_R2_ACCOUNT_ID',
      'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID',
      'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY',
      'TYPEBASE_STORAGE_R2_BUCKETS',
      'TYPEBASE_STORAGE_R2_PUBLIC_URL_AVATARS',
      'TYPEBASE_STORAGE_R2_PUBLIC_URL_USER_FILES',
    ]);
  });

  it.each(['vercel', 'cloudflare'] as const)('needs nothing for a %s storage running on local storage', (provider) => {
    expect(keysFor(provider, LOCAL_STORAGE)).toEqual([]);
  });

  it('needs nothing for a filesystem storage', () => {
    expect(keysFor('filesystem')).toEqual([]);
  });

  it('needs nothing, and reads no file, for a project without storage', () => {
    expect(getStorageEnvKeys({ provider: false, localStorage: undefined, storageFilePath: path.join(tmp.path, 'missing.ts') })).toEqual([]);
  });
});
