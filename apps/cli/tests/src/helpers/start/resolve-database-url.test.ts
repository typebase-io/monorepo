import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveDatabaseUrl } from '#helpers/start/resolve-database-url.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('resolveDatabaseUrl', () => {
  let tmp: TempDir;

  const resolve = (choice: { databaseUrl?: string; devDatabase?: boolean; prodDatabase?: boolean } = {}) =>
    withCwd(tmp.path, () =>
      resolveDatabaseUrl({
        databaseUrl: choice.databaseUrl,
        devDatabase: choice.devDatabase,
        prodDatabase: choice.prodDatabase,
        schemaFilePath: path.join(tmp.path, 'typebase/db/schema.ts'),
      })
    );

  const everyDatabaseInTheProject = () => {
    tmp.write(
      '.env',
      ['DATABASE_URL_LOCAL=postgres://project/local', 'DATABASE_URL_DEV=postgres://project/dev', 'DATABASE_URL=postgres://project/production'].join(
        '\n'
      ) + '\n'
    );
  };

  beforeEach(() => {
    tmp = createTempDir();
    tmp.write('typebase/db/schema.ts', 'export const todos = {};\n');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('runs against the local database when no database is chosen', async () => {
    everyDatabaseInTheProject();

    await expect(resolve()).resolves.toEqual({ url: 'postgres://project/local', source: 'DATABASE_URL_LOCAL' });
  });

  it('runs against the dev database only when asked for it', async () => {
    everyDatabaseInTheProject();

    await expect(resolve({ devDatabase: true })).resolves.toEqual({ url: 'postgres://project/dev', source: 'DATABASE_URL_DEV' });
  });

  it('runs against the production database only when asked for it', async () => {
    everyDatabaseInTheProject();

    await expect(resolve({ prodDatabase: true })).resolves.toEqual({ url: 'postgres://project/production', source: 'DATABASE_URL' });
  });

  it('runs against the URL it is given, whatever the project env file holds', async () => {
    everyDatabaseInTheProject();

    await expect(resolve({ databaseUrl: 'postgres://somewhere/else' })).resolves.toEqual({
      url: 'postgres://somewhere/else',
      source: 'the --database-url option',
    });
  });

  it('names every way of choosing when the local database is not set up', async () => {
    tmp.write('.env', 'DATABASE_URL_DEV=postgres://project/dev\nDATABASE_URL=postgres://project/production\n');

    await expect(resolve()).rejects.toThrow(
      'No local database URL found. Set DATABASE_URL_LOCAL in .env, or choose another database with --database-url, --dev-database or --prod-database.'
    );
  });

  it.each([
    { name: 'dev', choice: { devDatabase: true }, key: 'DATABASE_URL_DEV' },
    { name: 'production', choice: { prodDatabase: true }, key: 'DATABASE_URL' },
  ])('fails when the $name database it was asked for is not set up', async ({ choice, key }) => {
    tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');

    await expect(resolve(choice)).rejects.toThrow(`No database URL found in ${key}. Set it in .env, or pass one with --database-url.`);
  });

  it('never falls back from one database to another', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://project/production\n');

    await expect(resolve()).rejects.toThrow('No local database URL found');
    await expect(resolve({ devDatabase: true })).rejects.toThrow('No database URL found in DATABASE_URL_DEV');
  });

  it('needs no database at all for a project without a schema', async () => {
    tmp.cleanup();
    tmp = createTempDir();

    await expect(resolve()).resolves.toBeUndefined();
  });
});
