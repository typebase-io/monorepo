import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDeclaredStorage } from '#helpers/storage/get-declared-storage.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getDeclaredStorage', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const read = (source: string) => {
    tmp.write('storage.ts', removeExtraSpaces(source));

    return getDeclaredStorage(path.join(tmp.path, 'storage.ts'));
  };

  it('reads every declared bucket with its access', () => {
    expect(
      read(`
        import { defineStorage } from "typebase-io/server";

        export const storage = defineStorage({
          provider: "vercel",
          buckets: {
            avatars: { access: "public" },
            "user-documents": { access: "private" },
          },
        });
      `)
    ).toEqual({
      buckets: [
        { bucket: 'avatars', access: 'public' },
        { bucket: 'user-documents', access: 'private' },
      ],
      region: undefined,
      locationHint: undefined,
    });
  });

  it('reads the region and location hint the options declare', () => {
    expect(
      read(`
        export const storage = defineStorage({
          provider: "cloudflare",
          buckets: { avatars: { access: "public" } },
          options: { region: "iad1", locationHint: "weur" },
        });
      `)
    ).toEqual({ buckets: [{ bucket: 'avatars', access: 'public' }], region: 'iad1', locationHint: 'weur' });
  });

  it('reads the config from a local variable', () => {
    expect(
      read(`
        const config = { provider: "vercel", buckets: { avatars: { access: "private" } } };

        export const storage = defineStorage(config);
      `).buckets
    ).toEqual([{ bucket: 'avatars', access: 'private' }]);
  });

  it('refuses a storage file that never calls defineStorage', () => {
    expect(() => read('export const storage = { provider: "vercel", buckets: {} };')).toThrow(
      '`storage.ts` must call `defineStorage` with an inline object literal or a local variable initialized with one.'
    );
  });

  it('refuses a config it cannot read without running the file', () => {
    expect(() => read('export const storage = defineStorage(loadConfig());')).toThrow(
      '`storage.ts` must call `defineStorage` with an inline object literal or a local variable initialized with one.'
    );
  });

  it('refuses buckets that are not written inline', () => {
    expect(() => read('export const storage = defineStorage({ provider: "vercel", buckets: declaredBuckets });')).toThrow(
      '`defineStorage` in `storage.ts` needs a `buckets` object written inline, so bucket sync can read the declared buckets.'
    );
  });

  it('refuses a bucket that is not declared as an object', () => {
    expect(() => read('export const storage = defineStorage({ provider: "vercel", buckets: { avatars } });')).toThrow(
      'Could not read the bucket `avatars` in `storage.ts`. Declare every bucket as `name: { ... }`.'
    );
  });

  it('refuses a bucket that declares no access', () => {
    expect(() => read('export const storage = defineStorage({ provider: "vercel", buckets: { avatars: {} } });')).toThrow(
      "The bucket `avatars` in `storage.ts` has no access. Declare it `access: 'public'` or `access: 'private'`."
    );
  });

  it('refuses an access Typebase does not have', () => {
    expect(() => read('export const storage = defineStorage({ provider: "vercel", buckets: { avatars: { access: "shared" } } });')).toThrow(
      'The bucket `avatars` in `storage.ts` has the access `shared`. Use one of: public, private.'
    );
  });

  it('refuses a region that is not a plain string', () => {
    expect(() =>
      read('export const storage = defineStorage({ provider: "vercel", buckets: { avatars: { access: "public" } }, options: { region } });')
    ).toThrow('Could not read `region` in `storage.ts`.');
  });
});
