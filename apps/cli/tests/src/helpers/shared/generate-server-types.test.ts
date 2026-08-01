import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateServerTypes', () => {
  let tmp: TempDir;

  const TS_CONFIG = JSON.stringify({
    compilerOptions: { strict: true, skipLibCheck: true, noEmit: true, target: 'ESNext' },
    include: ['./**/*.ts'],
  });

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  test('when nothing is present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'none.txt');
  });

  test('when only router is present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'only-router.txt');
  });

  test('when only db is present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('db/schema.ts', 'export const schema = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'only-db.txt');
  });

  test('when only auth is present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('auth.ts', 'export const auth = {};');

    await expect(
      generateServerTypes({
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
        authFilePath: path.join(tmp.path, 'auth.ts'),
        envFilePath: path.join(tmp.path, 'env.ts'),
        actionsDirPath: path.join(tmp.path, 'actions'),
        generatedDirPath: path.join(tmp.path, 'generated'),
      })
    ).rejects.toThrow('Found `auth.ts` but no database schema at `db/schema.ts`');
  });

  test('when only env is present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('env.ts', 'export const env = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'only-env.txt');
  });

  test('when router and db are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    tmp.write('db/schema.ts', 'export const schema = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'router-and-db.txt');
  });

  test('when router and auth are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    tmp.write('auth.ts', 'export const auth = {};');

    await expect(
      generateServerTypes({
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
        authFilePath: path.join(tmp.path, 'auth.ts'),
        envFilePath: path.join(tmp.path, 'env.ts'),
        actionsDirPath: path.join(tmp.path, 'actions'),
        generatedDirPath: path.join(tmp.path, 'generated'),
      })
    ).rejects.toThrow('Found `auth.ts` but no database schema at `db/schema.ts`');
  });

  test('when router and env are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    tmp.write('env.ts', 'export const env = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'router-and-env.txt');
  });

  test('when db and auth are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('db/schema.ts', 'export const schema = {};');
    tmp.write('auth.ts', 'export const auth = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'db-and-auth.txt');
  });

  test('when db and env are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('db/schema.ts', 'export const schema = {};');
    tmp.write('env.ts', 'export const env = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'db-and-env.txt');
  });

  test('when auth and env are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('auth.ts', 'export const auth = {};');
    tmp.write('env.ts', 'export const env = {};');

    await expect(
      generateServerTypes({
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
        authFilePath: path.join(tmp.path, 'auth.ts'),
        envFilePath: path.join(tmp.path, 'env.ts'),
        actionsDirPath: path.join(tmp.path, 'actions'),
        generatedDirPath: path.join(tmp.path, 'generated'),
      })
    ).rejects.toThrow('Found `auth.ts` but no database schema at `db/schema.ts`');
  });

  test('when router, db and auth are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    tmp.write('db/schema.ts', 'export const schema = {};');
    tmp.write('auth.ts', 'export const auth = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'router-db-and-auth.txt');
  });

  test('when router, db and env are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    tmp.write('db/schema.ts', 'export const schema = {};');
    tmp.write('env.ts', 'export const env = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'router-db-and-env.txt');
  });

  test('when router, auth and env are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    tmp.write('auth.ts', 'export const auth = {};');
    tmp.write('env.ts', 'export const env = {};');

    await expect(
      generateServerTypes({
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
        authFilePath: path.join(tmp.path, 'auth.ts'),
        envFilePath: path.join(tmp.path, 'env.ts'),
        actionsDirPath: path.join(tmp.path, 'actions'),
        generatedDirPath: path.join(tmp.path, 'generated'),
      })
    ).rejects.toThrow('Found `auth.ts` but no database schema at `db/schema.ts`');
  });

  test('when db, auth and env are present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('db/schema.ts', 'export const schema = {};');
    tmp.write('auth.ts', 'export const auth = {};');
    tmp.write('env.ts', 'export const env = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'db-auth-and-env.txt');
  });

  test('when everything is present', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    tmp.write('db/schema.ts', 'export const schema = {};');
    tmp.write('auth.ts', 'export const auth = {};');
    tmp.write('env.ts', 'export const env = {};');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'all.txt');
  });
});
