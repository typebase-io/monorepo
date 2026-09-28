import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getStorageProvider } from '#helpers/shared/get-storage-provider.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getStorageProvider', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const read = (source: string) => {
    tmp.write('storage.ts', removeExtraSpaces(source));

    return getStorageProvider(path.join(tmp.path, 'storage.ts'));
  };

  it('reads the provider the storage was declared with', () => {
    expect(
      read(`
        import { defineStorage } from "typebase-io/server";

        export const storage = defineStorage({
          provider: "filesystem",
          buckets: { avatars: {} },
        });
      `)
    ).toBe('filesystem');
  });

  it.each(['vercel', 'cloudflare'])('reads the %s provider', (provider) => {
    expect(read(`export const storage = defineStorage({ provider: "${provider}", buckets: { avatars: { access: "public" } } });`)).toBe(provider);
  });

  it('refuses a provider Typebase does not have', () => {
    expect(() => read('export const storage = defineStorage({ provider: "memory", buckets: {} });')).toThrow(
      '`storage.ts` asks for the `memory` storage provider, which Typebase does not have. Pick one of: vercel, cloudflare, filesystem.'
    );
  });

  it('reads it from a config held in a variable', () => {
    expect(
      read(`
        const config = { provider: "filesystem", buckets: {} };

        export const storage = defineStorage(config);
      `)
    ).toBe('filesystem');
  });

  it('refuses a provider that is not a plain string, since it cannot be read without running the file', () => {
    expect(() => read('export const storage = defineStorage({ provider: chosenProvider, buckets: {} });')).toThrow(
      'Could not read which storage provider `storage.ts` asks for. `defineStorage` needs a `provider` written as a plain string, one of: vercel, cloudflare, filesystem.'
    );
  });

  it('refuses a config that is not an object literal, since it cannot be read without running the file', () => {
    expect(() => read('export const storage = defineStorage(loadConfig);')).toThrow('Could not read which storage provider `storage.ts` asks for.');
  });

  it('refuses a storage file that never calls defineStorage', () => {
    expect(() => read('export const storage = { provider: "filesystem" };')).toThrow(
      '`storage.ts` does not call `defineStorage`. Export a storage config from it, or delete the file.'
    );
  });

  it('is undefined when there is no storage file', () => {
    expect(getStorageProvider(path.join(tmp.path, 'missing.ts'))).toBeUndefined();
  });
});
