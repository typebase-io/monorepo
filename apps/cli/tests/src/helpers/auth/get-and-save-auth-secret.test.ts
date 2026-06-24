import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAndSaveAuthSecret } from '#helpers/auth/get-and-save-auth-secret.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('getAndSaveAuthSecret', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
    delete process.env.BETTER_AUTH_SECRET;
  });

  afterEach(() => {
    tmp.cleanup();
    delete process.env.BETTER_AUTH_SECRET;
  });

  it('returns the existing secret without rewriting the .env file', async () => {
    tmp.write('.env', 'BETTER_AUTH_SECRET=existing-secret\n');

    const secret = await withCwd(tmp.path, () => getAndSaveAuthSecret());

    expect(secret).toBe('existing-secret');
    expect(tmp.read('.env')).toBe('BETTER_AUTH_SECRET=existing-secret\n');
  });

  it('generates a 32-byte base64 secret and persists it when none exists', async () => {
    const secret = await withCwd(tmp.path, () => getAndSaveAuthSecret());

    expect(typeof secret).toBe('string');
    expect(Buffer.from(secret, 'base64')).toHaveLength(32);
    expect(tmp.read('.env')).toContain(`BETTER_AUTH_SECRET=${secret}`);
  });
});
