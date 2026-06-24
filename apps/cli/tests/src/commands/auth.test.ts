import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '#commands/auth.ts';

import { generateAuthSchema } from '#helpers/auth/generate-auth-schema.ts';
import { getAndSaveAuthSecret } from '#helpers/auth/get-and-save-auth-secret.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkBetterAuth } from '#tests/helpers/link-better-auth.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { listFiles } from '#tests/helpers/list-files.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const baseAuth = `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({
  trustedOrigins: ["http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
  },
});
`;

const pluginAuth = `import { twoFactor } from "better-auth/plugins";

import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({
  trustedOrigins: ["http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [twoFactor()],
});
`;

const { passThrough } = vi.hoisted(() => ({
  passThrough: (actual: Record<string, unknown>): Record<string, unknown> => {
    const mocked = { ...actual };

    for (const [key, value] of Object.entries(actual)) {
      if (typeof value === 'function') mocked[key] = vi.fn(value as (...args: unknown[]) => unknown);
    }

    return mocked;
  },
}));

vi.mock('#helpers/auth/generate-auth-schema.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/auth/get-and-save-auth-secret.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-db-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-server-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/get-typebase-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

describe('auth generate command', () => {
  let tmp: TempDir;

  beforeEach(async () => {
    vi.clearAllMocks();

    delete process.env.BETTER_AUTH_SECRET;

    tmp = createTempDir();

    linkTypebaseIo(tmp);

    await generateTypebaseProject(tmp);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;

    delete process.env.BETTER_AUTH_SECRET;

    vi.restoreAllMocks();
  });

  it('appends the auth tables to the schema and relations and regenerates the types', async () => {
    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('auth', 'schema.ts.txt');
    expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('auth', 'relations.ts.txt');
    expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
    expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('codegen', 'server.ts.txt');

    const warnings = vi.mocked(console.warn).mock.calls.flat().map(String).join('\n');

    expect(warnings).toContain('Base URL could not be determined');
  });

  it('stays idempotent when the auth tables already exist in the schema', async () => {
    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('auth', 'schema.ts.txt');
    expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('auth', 'relations.ts.txt');

    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('auth', 'schema.ts.txt');
    expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('auth', 'relations.ts.txt');
  });

  it('generates and persists a BETTER_AUTH_SECRET when none exists', async () => {
    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.exists('.env')).toBe(true);

    const secret = /BETTER_AUTH_SECRET=(.+)/.exec(tmp.read('.env'))?.[1] ?? '';

    expect(Buffer.from(secret, 'base64')).toHaveLength(32);
  });

  it('preserves an existing BETTER_AUTH_SECRET in the .env file', async () => {
    tmp.write('.env', 'BETTER_AUTH_SECRET=existing-secret\n');

    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.read('.env')).toBe('BETTER_AUTH_SECRET=existing-secret\n');
  });

  it('does not write a .env file when BETTER_AUTH_SECRET is set in the environment', async () => {
    process.env.BETTER_AUTH_SECRET = 'from-environment';

    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.exists('.env')).toBe(false);
  });

  it('throws and changes nothing when there is no auth config', async () => {
    const schemaBefore = tmp.read('typebase/db/schema.ts');

    fs.rmSync(path.join(tmp.path, 'typebase/auth.ts'));

    await expect(withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }))).rejects.toThrow(
      'No auth config found. Create an auth file at auth.ts first.'
    );

    expect(vi.mocked(getAndSaveAuthSecret)).not.toHaveBeenCalled();
    expect(vi.mocked(generateAuthSchema)).not.toHaveBeenCalled();
    expect(tmp.read('typebase/db/schema.ts')).toBe(schemaBefore);
    expect(tmp.exists('.env')).toBe(false);
  });

  it('throws and changes nothing when there is no database schema', async () => {
    fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

    await expect(withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }))).rejects.toThrow(
      'No database schema found. Create a schema file at db/schema.ts first.'
    );

    expect(vi.mocked(getAndSaveAuthSecret)).not.toHaveBeenCalled();
    expect(vi.mocked(generateAuthSchema)).not.toHaveBeenCalled();
    expect(tmp.exists('.env')).toBe(false);
    expect(listFiles(path.join(tmp.path, 'typebase', '_generated'))).toEqual([]);
  });

  describe('propagates failures', () => {
    const cases: { name: string; mock: () => { mockRejectedValueOnce: (e: Error) => unknown } }[] = [
      { name: 'getTypebaseConfig', mock: () => vi.mocked(getTypebaseConfig) },
      { name: 'getAndSaveAuthSecret', mock: () => vi.mocked(getAndSaveAuthSecret) },
      { name: 'generateAuthSchema', mock: () => vi.mocked(generateAuthSchema) },
      { name: 'generateDBTypes', mock: () => vi.mocked(generateDBTypes) },
      { name: 'generateServerTypes', mock: () => vi.mocked(generateServerTypes) },
    ];

    it.each(cases)('rejects when $name throws', async ({ mock }) => {
      mock().mockRejectedValueOnce(new Error('boom'));

      await expect(withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }))).rejects.toThrow('boom');
    });
  });
});

describe('auth generate command — configuration changes', () => {
  let tmp: TempDir;

  const template = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), '../../helpers/expected-templates/auth', name);

  beforeEach(async () => {
    vi.clearAllMocks();

    delete process.env.BETTER_AUTH_SECRET;

    tmp = createTempDir();

    linkTypebaseIo(tmp);
    linkBetterAuth(tmp);

    await generateTypebaseProject(tmp, { withAuth: false });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    delete process.env.BETTER_AUTH_SECRET;
    vi.restoreAllMocks();
  });

  it('adds the auth tables when an auth config is introduced', async () => {
    expect(tmp.read('typebase/db/schema.ts')).not.toContain('export const users');

    tmp.write('typebase/auth.ts', baseAuth);

    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('auth', 'added-schema.ts.txt');
    expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('auth', 'added-relations.ts.txt');
    expect(tmp.read('typebase/_generated/db.d.ts')).toEqualTemplate('codegen', 'db.d.ts.txt');
    expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('auth', 'added-server.ts.txt');
  });

  it('throws and leaves the generated tables in place when the auth config is removed', async () => {
    tmp.write('typebase/db/schema.ts', fs.readFileSync(template('added-schema.ts.txt'), 'utf8'));
    tmp.write('typebase/db/relations.ts', fs.readFileSync(template('added-relations.ts.txt'), 'utf8'));

    await expect(withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }))).rejects.toThrow(
      'No auth config found. Create an auth file at auth.ts first.'
    );

    expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('auth', 'added-schema.ts.txt');
    expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('auth', 'added-relations.ts.txt');
  });

  it('adds the plugin tables when a plugin is added to the auth config', async () => {
    tmp.write('typebase/db/schema.ts', fs.readFileSync(template('added-schema.ts.txt'), 'utf8'));
    tmp.write('typebase/db/relations.ts', fs.readFileSync(template('added-relations.ts.txt'), 'utf8'));
    tmp.write('typebase/auth.ts', pluginAuth);

    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('auth', 'with-plugin-schema.ts.txt');
    expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('auth', 'with-plugin-relations.ts.txt');
  });

  it('drops the plugin columns but keeps the orphaned plugin table when a plugin is removed', async () => {
    tmp.write('typebase/db/schema.ts', fs.readFileSync(template('with-plugin-schema.ts.txt'), 'utf8'));
    tmp.write('typebase/db/relations.ts', fs.readFileSync(template('with-plugin-relations.ts.txt'), 'utf8'));
    tmp.write('typebase/auth.ts', baseAuth);

    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));

    expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('auth', 'after-removing-plugin-schema.ts.txt');
    expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('auth', 'after-removing-plugin-relations.ts.txt');
  });
});
