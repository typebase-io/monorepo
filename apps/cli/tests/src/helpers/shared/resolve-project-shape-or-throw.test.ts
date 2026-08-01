import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('resolveProjectShapeOrThrow', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const run = () =>
    resolveProjectShapeOrThrow({
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
    });

  const writeSchema = () => tmp.write('db/schema.ts', 'export const schema = {};');
  const writeAuth = () => tmp.write('auth.ts', 'export const auth = {};');
  const writeEnv = () => tmp.write('env.ts', 'export const env = {};');

  it('reports an empty project', () => {
    expect(run()).toEqual({ hasDB: false, hasAuth: false, hasEnv: false, needsEnvModule: false });
  });

  it('reports a project with only a database schema', () => {
    writeSchema();

    expect(run()).toEqual({ hasDB: true, hasAuth: false, hasEnv: false, needsEnvModule: true });
  });

  it('reports a project with only an env schema', () => {
    writeEnv();

    expect(run()).toEqual({ hasDB: false, hasAuth: false, hasEnv: true, needsEnvModule: true });
  });

  it('reports a project with everything', () => {
    writeSchema();
    writeAuth();
    writeEnv();

    expect(run()).toEqual({ hasDB: true, hasAuth: true, hasEnv: true, needsEnvModule: true });
  });

  it('asks for an env module whenever the database or auth needs one, without a declared env schema', () => {
    writeSchema();
    writeAuth();

    expect(run()).toEqual({ hasDB: true, hasAuth: true, hasEnv: false, needsEnvModule: true });
  });

  it('refuses a project that has auth but no database schema', () => {
    writeAuth();

    expect(() => run()).toThrow('Found `auth.ts` but no database schema at `db/schema.ts`');
  });

  it('points at both ways out when it refuses', () => {
    writeAuth();

    expect(() => run()).toThrow('run `npx typebase-io-cli auth generate`, or remove `auth.ts`');
  });

  it('refuses auth without a database schema even when an env schema is declared', () => {
    writeAuth();
    writeEnv();

    expect(() => run()).toThrow('Found `auth.ts` but no database schema at `db/schema.ts`');
  });
});
