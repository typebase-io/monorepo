import { createHash } from 'node:crypto';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readMigrationFiles } from '#helpers/db/read-migration-files.ts';
import { type PostgresSnapshot } from '#helpers/db/read-migrations.ts';
import { writeMigration } from '#helpers/db/write-migration.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('readMigrationFiles', () => {
  let tmp: TempDir;
  let migrationsDirPath: string;

  beforeEach(() => {
    tmp = createTempDir();
    migrationsDirPath = tmp.mkdir('migrations');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns an empty list when the migrations directory does not exist', () => {
    expect(readMigrationFiles(path.join(tmp.path, 'nope'))).toEqual([]);
  });

  it('returns an empty list for an empty migrations directory', () => {
    expect(readMigrationFiles(migrationsDirPath)).toEqual([]);
  });

  it('splits a migration into one entry per statement', () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'CREATE TABLE "a";\n\n----------------------------\n\nCREATE TABLE "b";\n');

    expect(readMigrationFiles(migrationsDirPath)[0]?.sql).toEqual(['CREATE TABLE "a";', 'CREATE TABLE "b";\n']);
  });

  it('keeps a single-statement migration as one entry', () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'CREATE TABLE "a";\n');

    expect(readMigrationFiles(migrationsDirPath)[0]?.sql).toEqual(['CREATE TABLE "a";\n']);
  });

  it('drops empty statements so a trailing separator cannot produce a blank query', () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'CREATE TABLE "a";\n\n----------------------------\n\n');

    expect(readMigrationFiles(migrationsDirPath)[0]?.sql).toEqual(['CREATE TABLE "a";']);
  });

  it('returns migrations oldest first regardless of directory order', () => {
    tmp.write('migrations/20260301000000_third/migration.sql', 'SELECT 3;');
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');
    tmp.write('migrations/20260201000000_second/migration.sql', 'SELECT 2;');

    expect(readMigrationFiles(migrationsDirPath).map(({ name }) => name)).toEqual([
      '20260101000000_first',
      '20260201000000_second',
      '20260301000000_third',
    ]);
  });

  it('reads the leading timestamp back as a UTC instant', () => {
    tmp.write('migrations/20260304050607_first/migration.sql', 'SELECT 1;');

    expect(readMigrationFiles(migrationsDirPath)[0]?.folderMillis).toBe(Date.parse('2026-03-04T05:06:07.000Z'));
  });

  it('hashes the file as drizzle does, so an unchanged migration keeps its hash', () => {
    const contents = 'CREATE TABLE "a";\n';

    tmp.write('migrations/20260101000000_first/migration.sql', contents);

    expect(readMigrationFiles(migrationsDirPath)[0]?.hash).toBe(createHash('sha256').update(contents).digest('hex'));
  });

  it('ignores a directory that carries a snapshot but no sql', () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');
    tmp.write('migrations/20260201000000_snapshot_only/snapshot.json', '{}');

    expect(readMigrationFiles(migrationsDirPath)).toHaveLength(1);
  });

  it('reads back one statement per statement a generated migration was written with', async () => {
    const snapshot = { version: '8', dialect: 'postgres', id: 'a', prevIds: ['b'], ddl: [], renames: [] } as unknown as PostgresSnapshot;

    await writeMigration({ migrationsDirPath, name: 'first', sqlStatements: ['CREATE TABLE "a";', 'CREATE TABLE "b";'], snapshot });

    expect(readMigrationFiles(migrationsDirPath)[0]?.sql).toHaveLength(2);
  });

  it('ignores loose files sitting next to the migration directories', () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');
    tmp.write('migrations/README.md', 'not a migration');

    expect(readMigrationFiles(migrationsDirPath)).toHaveLength(1);
  });
});
