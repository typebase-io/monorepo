import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyServerAssets } from '#helpers/generate-server/copy-server-assets.ts';

import { listFiles } from '#tests/helpers/list-files.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('copyServerAssets', () => {
  let tmp: TempDir;
  let tempServerDirPath: string;
  let serverDistDirPath: string;

  const copy = () => copyServerAssets({ tempServerDirPath, serverDistDirPath });

  beforeEach(() => {
    tmp = createTempDir();

    tempServerDirPath = tmp.mkdir('server');
    serverDistDirPath = tmp.mkdir('dist');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('copies the migration files the transpiler does not emit', async () => {
    tmp.write('server/src/db/migrations/20260101000000_initial/migration.sql', 'CREATE TABLE "todos";');
    tmp.write('server/src/db/migrations/20260101000000_initial/snapshot.json', '{"id":"one"}');

    await copy();

    expect(listFiles(serverDistDirPath)).toEqual([
      'src/db/migrations/20260101000000_initial/migration.sql',
      'src/db/migrations/20260101000000_initial/snapshot.json',
    ]);
  });

  it('copies the contents unchanged', async () => {
    tmp.write('server/src/db/migrations/20260101000000_initial/migration.sql', 'CREATE TABLE "todos";');

    await copy();

    expect(fs.readFileSync(path.join(serverDistDirPath, 'src/db/migrations/20260101000000_initial/migration.sql'), 'utf8')).toBe(
      'CREATE TABLE "todos";'
    );
  });

  it('leaves typescript alone, because the transpiler emits that itself', async () => {
    tmp.write('server/src/db/schema.ts', 'export const todos = {};');
    tmp.write('server/src/index.ts', 'export const server = {};');
    tmp.write('server/src/db/migrations/20260101000000_initial/migration.sql', 'CREATE TABLE "todos";');

    await copy();

    expect(listFiles(serverDistDirPath)).toEqual(['src/db/migrations/20260101000000_initial/migration.sql']);
  });

  it('copies nothing when the project has no migrations', async () => {
    tmp.write('server/src/db/schema.ts', 'export const todos = {};');

    expect(await copy()).toBe(0);
    expect(listFiles(serverDistDirPath)).toEqual([]);
  });

  it('copies nothing when there is no src directory at all', async () => {
    expect(await copy()).toBe(0);
    expect(listFiles(serverDistDirPath)).toEqual([]);
  });

  it('overwrites an asset left behind by an earlier build', async () => {
    tmp.write('dist/src/db/migrations/20260101000000_initial/migration.sql', 'CREATE TABLE "stale";');
    tmp.write('server/src/db/migrations/20260101000000_initial/migration.sql', 'CREATE TABLE "todos";');

    await copy();

    expect(fs.readFileSync(path.join(serverDistDirPath, 'src/db/migrations/20260101000000_initial/migration.sql'), 'utf8')).toBe(
      'CREATE TABLE "todos";'
    );
  });
});
