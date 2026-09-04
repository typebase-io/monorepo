import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBasePathFromAuth } from '#helpers/shared/get-base-path-from-auth.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getBasePathFromAuth', () => {
  let tmp: TempDir;

  const run = (source: string) => {
    tmp.write('auth.ts', source);

    return getBasePathFromAuth(path.join(tmp.path, 'auth.ts'));
  };

  const authFile = (options: string) => `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({${options}});`;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('reads a base path the developer set', () => {
    expect(run(authFile(' basePath: "/mine", '))).toBe('/mine');
  });

  it('reads a base path written as a template literal', () => {
    expect(run(authFile(' basePath: `/mine`, '))).toBe('/mine');
  });

  it('returns nothing when no base path is set', () => {
    expect(run(authFile(' emailAndPassword: { enabled: true }, '))).toBeUndefined();
  });

  it('uses the auth instance when the base path is not a literal', () => {
    expect(run(`const PREFIX = "/mine";\n\n${authFile(' basePath: PREFIX, ')}`)).toEqual({ fromAuth: true });
  });

  it('returns nothing when auth options cannot be resolved statically', () => {
    expect(
      run('import { defineAuth } from "typebase-io/server"; import { options } from "./options.js"; export const auth = defineAuth(options);')
    ).toBeUndefined();
  });

  it('uses the default auth path when the configured literal is empty', () => {
    expect(run(authFile(' basePath: "", '))).toBe('/api/auth');
  });

  it('uses the auth instance when a spread can override the base path', () => {
    expect(run(authFile(' basePath: "/mine", ...options, '))).toEqual({ fromAuth: true });
  });

  it('uses the auth instance for a shorthand base path property', () => {
    expect(run(`const basePath = "/mine";\n\n${authFile(' basePath, ')}`)).toEqual({ fromAuth: true });
  });

  it('returns nothing when the file has no defineAuth call', () => {
    expect(run('export const auth = {};')).toBeUndefined();
  });
});
