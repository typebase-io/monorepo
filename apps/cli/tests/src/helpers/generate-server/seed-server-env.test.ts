import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { seedServerEnv } from '#helpers/generate-server/seed-server-env.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('seedServerEnv', () => {
  let tmp: TempDir;
  let serverDistDirPath: string;

  const seed = (keys: string[]) => withCwd(tmp.path, () => seedServerEnv({ serverDistDirPath, keys }));

  const serverEnv = () => (fs.existsSync(path.join(serverDistDirPath, '.env')) ? fs.readFileSync(path.join(serverDistDirPath, '.env'), 'utf8') : '');

  beforeEach(() => {
    tmp = createTempDir();
    serverDistDirPath = tmp.mkdir('typebase/_server');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('copies the keys the generated server validates', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://prod/db\nBETTER_AUTH_SECRET=shh\n');

    expect(await seed(['DATABASE_URL', 'BETTER_AUTH_SECRET'])).toEqual(['DATABASE_URL', 'BETTER_AUTH_SECRET']);

    expect(serverEnv()).toBe('DATABASE_URL=postgres://prod/db\nBETTER_AUTH_SECRET=shh\n');
  });

  it('prefers the dev database, so a local server does not reach production', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://prod/db\nDATABASE_URL_DEV=postgres://dev/db\n');

    await seed(['DATABASE_URL']);

    expect(serverEnv()).toBe('DATABASE_URL=postgres://dev/db\n');
  });

  it('falls back to the only database there is', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://prod/db\n');

    await seed(['DATABASE_URL']);

    expect(serverEnv()).toBe('DATABASE_URL=postgres://prod/db\n');
  });

  it('copies keys declared in the project env schema', async () => {
    tmp.write('.env', 'RESEND_API_KEY=re_123\n');

    expect(await seed(['RESEND_API_KEY'])).toEqual(['RESEND_API_KEY']);
  });

  it('leaves out everything the server does not validate', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://prod/db\nNEON_API_KEY=napi_secret\nVERCEL_TOKEN=vt_secret\n');

    await seed(['DATABASE_URL']);

    expect(serverEnv()).not.toContain('NEON_API_KEY');
    expect(serverEnv()).not.toContain('VERCEL_TOKEN');
  });

  it('never overwrites a value already there', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://prod/db\n');
    tmp.write('typebase/_server/.env', 'DATABASE_URL=postgres://my-own/db\n');

    expect(await seed(['DATABASE_URL'])).toEqual([]);

    expect(serverEnv()).toBe('DATABASE_URL=postgres://my-own/db\n');
  });

  it('fills in only what is missing, keeping the rest of the file', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://prod/db\nBETTER_AUTH_SECRET=shh\n');
    tmp.write('typebase/_server/.env', 'DATABASE_URL=postgres://my-own/db\n');

    expect(await seed(['DATABASE_URL', 'BETTER_AUTH_SECRET'])).toEqual(['BETTER_AUTH_SECRET']);

    expect(serverEnv()).toBe('DATABASE_URL=postgres://my-own/db\nBETTER_AUTH_SECRET=shh\n');
  });

  it('starts a line rather than joining one when the file has no trailing newline', async () => {
    tmp.write('.env', 'BETTER_AUTH_SECRET=shh\n');
    tmp.write('typebase/_server/.env', 'DATABASE_URL=postgres://my-own/db');

    await seed(['BETTER_AUTH_SECRET']);

    expect(serverEnv()).toBe('DATABASE_URL=postgres://my-own/db\nBETTER_AUTH_SECRET=shh\n');
  });

  it('writes nothing when the project has no env file', async () => {
    expect(await seed(['DATABASE_URL'])).toEqual([]);
    expect(serverEnv()).toBe('');
  });

  it('writes nothing when the project env has none of the keys', async () => {
    tmp.write('.env', 'NEON_API_KEY=napi_secret\n');

    expect(await seed(['DATABASE_URL'])).toEqual([]);
    expect(serverEnv()).toBe('');
  });

  it('writes nothing when the server validates no keys at all', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://prod/db\n');

    expect(await seed([])).toEqual([]);
    expect(serverEnv()).toBe('');
  });
});
