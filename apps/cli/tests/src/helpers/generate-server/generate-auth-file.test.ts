import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateAuthFile } from '#helpers/generate-server/generate-auth-file.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const AUTH_SOURCE = `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({
  emailAndPassword: { enabled: true },
});`;

describe('generateAuthFile', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const run = (source: string, options: { useTs?: boolean; provider?: 'vercel' | 'deno' | 'cloudflare' } = {}) => {
    tmp.write('auth.ts', source);

    return generateAuthFile({
      authFilePath: path.join(tmp.path, 'auth.ts'),
      authOutputDirPath: path.join(tmp.path, 'out'),
      useTs: options.useTs ?? true,
      provider: options.provider,
    });
  };

  it('creates the output directory even when it does not exist yet', async () => {
    tmp.write('auth.ts', AUTH_SOURCE);

    const authOutputDirPath = path.join(tmp.path, 'does', 'not', 'exist');

    await generateAuthFile({
      authFilePath: path.join(tmp.path, 'auth.ts'),
      authOutputDirPath,
      useTs: true,
      provider: undefined,
    });

    expect(fs.statSync(authOutputDirPath).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(authOutputDirPath, 'auth.ts'))).toBe(true);
  });

  it('swaps defineAuth for betterAuth with a drizzle adapter and no baseURL by default', async () => {
    await run(AUTH_SOURCE);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'default.txt');
  });

  it('ignores call expressions other than defineAuth', async () => {
    const source = `import { defineAuth } from "typebase-io/server";

const flag = Boolean(1);
export const auth = defineAuth({ emailAndPassword: { enabled: flag } });`;

    await run(source);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'other-call.txt');
  });

  it('adds a vercel baseURL with allowed hosts', async () => {
    await run(AUTH_SOURCE, { provider: 'vercel' });

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'vercel.txt');
  });

  it('adds deno allowed hosts', async () => {
    await run(AUTH_SOURCE, { provider: 'deno' });

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'deno.txt');
  });

  it('adds cloudflare allowed hosts', async () => {
    await run(AUTH_SOURCE, { provider: 'cloudflare' });

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'cloudflare.txt');
  });

  it('does not add a baseURL when one is already present', async () => {
    const source = `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({
  baseURL: "https://example.com",
  emailAndPassword: { enabled: true },
});`;

    await run(source, { provider: 'vercel' });

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'existing-baseurl.txt');
  });

  it('rewrites extensionless relative imports to .js when useTs is false', async () => {
    const source = `import { defineAuth } from "typebase-io/server";
import { helper } from "./helper";

export const auth = defineAuth({ emailAndPassword: { enabled: true } });`;

    await run(source, { useTs: false });

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'js-imports.txt');
  });

  it('rewrites auth plugin imports to better-auth/plugins and keeps the plugins option', async () => {
    const source = `import { defineAuth } from "typebase-io/server";
import { username } from "typebase-io/server/auth-plugins";

export const auth = defineAuth({
  trustedOrigins: ["http://localhost:3000"],
  emailAndPassword: { enabled: true },
  plugins: [username()],
});`;

    await run(source);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'plugins.txt');
  });

  it('removes @typebase-io/typebase imports as well', async () => {
    const source = `import { defineAuth } from "@typebase-io/typebase/server";

export const auth = defineAuth({ emailAndPassword: { enabled: true } });`;

    await run(source);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'scoped-import.txt');
  });

  it('resolves a variable reference argument to its object literal and transforms it', async () => {
    const source = `import { defineAuth } from "typebase-io/server";

const config = { emailAndPassword: { enabled: true } };
export const auth = defineAuth(config);`;

    await run(source);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'non-object-arg.txt');
  });

  it('leaves the call untouched when the argument is not a resolvable reference', async () => {
    const source = `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth(getConfig());`;

    await run(source);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'unresolved-call.txt');
  });

  it('leaves the call untouched when the referenced variable does not hold an object literal', async () => {
    const source = `import { defineAuth } from "typebase-io/server";

const config = makeConfig();
export const auth = defineAuth(config);`;

    await run(source);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'unresolved-variable.txt');
  });

  it('only inserts the better-auth imports when there is no defineAuth call', async () => {
    const source = `import { something } from "typebase-io/server";

export const auth = {};`;

    await run(source);

    expect(tmp.read('out/auth.ts')).toEqualTemplate('generate-auth-file', 'no-defineauth.txt');
  });
});
